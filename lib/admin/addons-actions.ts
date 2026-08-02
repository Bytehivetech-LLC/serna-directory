"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { slugify } from "@/lib/utils/slug";
import {
  syncStripeProductPrice,
  archiveStripeProduct,
  reconcileStripe,
} from "@/lib/stripe/sync";
import { ADDON_EFFECT_VALUES } from "@/lib/addons/effects";
import { enqueueAssetDeletion, pathFromPublicUrl } from "@/lib/assets/lifecycle";
import { activePurchaseCount } from "./addons-queries";
import type { AdminActionResult } from "./users-actions";

const ASSETS_BUCKET = "site-assets";

export type AddonActionResult =
  | { ok: true; id?: string; warning?: string | null }
  | { ok: false; error: string };

const addonSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z.string().trim().max(80).optional(),
  short_description: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  price_cents: z.number().int().min(0).max(100_000_00),
  currency: z.string().trim().length(3).default("usd"),
  interval: z.enum(["one_time", "month", "year"]),
  duration_days: z.number().int().min(1).max(3650).nullable().default(null),
  effect: z.enum(ADDON_EFFECT_VALUES),
  effect_value: z.number().int().min(0).max(100000).default(0),
  max_quantity: z.number().int().min(1).max(100).default(1),
  package_ids: z.array(z.string().uuid()).max(50).default([]),
  fulfilment_note: z.string().trim().max(2000).optional().nullable(),
  badge_label: z.string().trim().max(40).optional().nullable(),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(true),
});

export type AddonInput = z.infer<typeof addonSchema>;

export async function createAddonAction(input: AddonInput): Promise<AddonActionResult> {
  await requireAdmin();
  const parsed = addonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();
  const slug = (d.slug?.trim() || slugify(d.name)) || `addon-${Date.now()}`;

  const { data: created, error } = await admin
    .from("addons")
    .insert({
      name: d.name,
      slug,
      short_description: d.short_description ?? null,
      description: d.description ?? null,
      price_cents: d.price_cents,
      currency: d.currency.toLowerCase(),
      interval: d.interval,
      duration_days: d.duration_days,
      effect: d.effect,
      effect_value: d.effect_value,
      max_quantity: d.max_quantity,
      package_ids: d.package_ids,
      fulfilment_note: d.fulfilment_note ?? null,
      badge_label: d.badge_label ?? null,
      is_active: d.is_active,
      is_public: d.is_public,
    })
    .select("id")
    .single();
  if (error || !created) {
    return {
      ok: false,
      error: error?.code === "23505" ? "That slug already exists." : "Couldn't create the add-on.",
    };
  }

  const sync = await syncStripeProductPrice({
    id: created.id,
    kind: "addon",
    name: d.name,
    description: d.short_description ?? d.description,
    priceCents: d.price_cents,
    currency: d.currency,
    interval: d.interval,
    productId: null,
    priceId: null,
  });
  if (sync.productId || sync.priceId) {
    await admin
      .from("addons")
      .update({ stripe_product_id: sync.productId, stripe_price_id: sync.priceId })
      .eq("id", created.id);
  }

  await logAudit({
    action: "addon.create",
    entityType: "addon",
    entityId: created.id,
    after: { name: d.name, price_cents: d.price_cents, effect: d.effect },
  });
  revalidatePath("/admin/addons");
  return { ok: true, id: created.id, warning: sync.warning };
}

export async function updateAddonAction(
  id: string,
  input: AddonInput,
): Promise<AddonActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid add-on." };
  const parsed = addonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin.from("addons").select("*").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "That add-on no longer exists." };

  const { error } = await admin
    .from("addons")
    .update({
      name: d.name,
      slug: d.slug?.trim() || before.slug,
      short_description: d.short_description ?? null,
      description: d.description ?? null,
      price_cents: d.price_cents,
      currency: d.currency.toLowerCase(),
      interval: d.interval,
      duration_days: d.duration_days,
      effect: d.effect,
      effect_value: d.effect_value,
      max_quantity: d.max_quantity,
      package_ids: d.package_ids,
      fulfilment_note: d.fulfilment_note ?? null,
      badge_label: d.badge_label ?? null,
      is_active: d.is_active,
      is_public: d.is_public,
    })
    .eq("id", id);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That slug already exists." : "Couldn't save the add-on.",
    };
  }

  const sync = await syncStripeProductPrice({
    id,
    kind: "addon",
    name: d.name,
    description: d.short_description ?? d.description,
    priceCents: d.price_cents,
    currency: d.currency,
    interval: d.interval,
    productId: before.stripe_product_id,
    priceId: before.stripe_price_id,
  });
  await admin
    .from("addons")
    .update({ stripe_product_id: sync.productId, stripe_price_id: sync.priceId })
    .eq("id", id);

  await logAudit({
    action: "addon.update",
    entityType: "addon",
    entityId: id,
    before: { name: before.name, price_cents: before.price_cents },
    after: { name: d.name, price_cents: d.price_cents },
    meta: sync.priceChanged ? { price_changed: true, archived_price: sync.archivedPriceId } : undefined,
  });
  revalidatePath("/admin/addons");
  revalidatePath(`/admin/addons/${id}`);
  return { ok: true, id, warning: sync.warning };
}

export async function reorderAddonsAction(orderedIds: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(
    parsed.data.map((id, i) => admin.from("addons").update({ sort_order: i }).eq("id", id)),
  );
  await logAudit({ action: "addon.reorder", entityType: "addon", meta: { order: parsed.data } });
  revalidatePath("/admin/addons");
  return { ok: true, message: "Order saved." };
}

export async function archiveAddonAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid add-on." };
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("addons")
    .select("stripe_product_id, stripe_price_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!a) return { ok: false, error: "That add-on no longer exists." };

  const { error } = await admin
    .from("addons")
    .update({ is_active: false, is_public: false })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't archive that add-on." };
  await archiveStripeProduct(a.stripe_product_id, a.stripe_price_id);
  await logAudit({ action: "addon.archive", entityType: "addon", entityId: id });
  revalidatePath("/admin/addons");
  return { ok: true, message: `${a.name} archived.` };
}

export async function deleteAddonAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid add-on." };
  const admin = createAdminClient();

  const active = await activePurchaseCount(id);
  if (active > 0) {
    return {
      ok: false,
      error: `${active} active purchase${active === 1 ? "" : "s"} of this add-on. Archive it instead.`,
    };
  }
  const { data: a } = await admin
    .from("addons")
    .select("stripe_product_id, stripe_price_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!a) return { ok: false, error: "That add-on no longer exists." };

  const { error } = await admin.from("addons").delete().eq("id", id);
  if (error) {
    return { ok: false, error: "Existing purchases reference this add-on. Archive it instead." };
  }
  await archiveStripeProduct(a.stripe_product_id, a.stripe_price_id);
  await logAudit({ action: "addon.delete", entityType: "addon", entityId: id, meta: { name: a.name } });
  revalidatePath("/admin/addons");
  return { ok: true, message: `${a.name} deleted.` };
}

export async function reconcileAddonAction(
  id: string,
): Promise<{ ok: boolean; messages: string[] }> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, messages: ["Invalid add-on."] };
  const admin = createAdminClient();
  const { data: a } = await admin.from("addons").select("*").eq("id", id).maybeSingle();
  if (!a) return { ok: false, messages: ["That add-on no longer exists."] };
  const report = await reconcileStripe({
    id: a.id,
    kind: "addon",
    name: a.name,
    description: a.short_description ?? a.description,
    priceCents: a.price_cents,
    currency: a.currency,
    interval: a.interval,
    productId: a.stripe_product_id,
    priceId: a.stripe_price_id,
  });
  await logAudit({ action: "addon.reconcile", entityType: "addon", entityId: id });
  revalidatePath(`/admin/addons/${id}`);
  return report;
}

/* --------------------------------------------------------------- image --- */

export async function signAddonImageUploadAction(
  addonId: string,
  ext: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(addonId).success) return { ok: false, error: "Invalid add-on." };
  const safeExt = /^(png|jpg|jpeg|webp)$/i.test(ext) ? ext.toLowerCase() : "png";
  const admin = createAdminClient();
  const path = `addons/${addonId}/${crypto.randomUUID()}.${safeExt}`;
  const { data, error } = await admin.storage
    .from(ASSETS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't prepare the upload." };
  return { ok: true, path, token: data.token };
}

export async function setAddonImageAction(
  addonId: string,
  path: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(addonId).success) return { ok: false, error: "Invalid add-on." };
  const admin = createAdminClient();

  // Queue the previous card image for removal.
  const { data: prev } = await admin.from("addons").select("image_url").eq("id", addonId).maybeSingle();
  const oldPath = pathFromPublicUrl(prev?.image_url ?? null, ASSETS_BUCKET);
  if (oldPath && oldPath !== path) {
    await enqueueAssetDeletion(admin, ASSETS_BUCKET, oldPath, "replaced:addon_image");
  }

  const publicUrl = admin.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from("addons").update({ image_url: publicUrl }).eq("id", addonId);
  if (error) return { ok: false, error: "Couldn't save the image." };
  await logAudit({ action: "addon.image", entityType: "addon", entityId: addonId });
  revalidatePath(`/admin/addons/${addonId}`);
  return { ok: true, message: "Image updated." };
}
