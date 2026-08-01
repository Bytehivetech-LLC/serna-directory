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
import { activeSubscriberCount } from "./packages-queries";
import type { AdminActionResult } from "./users-actions";

export type PackageActionResult =
  | { ok: true; id?: string; message?: string; warning?: string | null }
  | { ok: false; error: string };

const packageSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z.string().trim().max(80).optional(),
  tagline: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  price_cents: z.number().int().min(0).max(100_000_00),
  currency: z.string().trim().length(3).default("usd"),
  interval: z.enum(["one_time", "month", "year"]),
  trial_days: z.number().int().min(0).max(365).default(0),
  min_listings: z.number().int().min(0).max(1000).default(1),
  max_listings: z.number().int().min(1).max(100000).nullable().default(null),
  max_images: z.number().int().min(0).max(100).default(8),
  requires_approval: z.boolean().default(true),
  allows_featured: z.boolean().default(false),
  priority_rank: z.number().int().min(0).max(1000).default(0),
  badge_label: z.string().trim().max(40).optional().nullable(),
  badge_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6c4ce8.")
    .optional()
    .nullable(),
  features: z.array(z.string().trim().max(160)).max(20).default([]),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export type PackageInput = z.infer<typeof packageSchema>;

/** Only one package may be the default. */
async function clearOtherDefaults(
  admin: ReturnType<typeof createAdminClient>,
  keepId: string | null,
) {
  let q = admin.from("packages").update({ is_default: false }).eq("is_default", true);
  if (keepId) q = q.neq("id", keepId);
  await q;
}

export async function createPackageAction(
  input: PackageInput,
): Promise<PackageActionResult> {
  await requireAdmin();
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();

  const slug = (d.slug?.trim() || slugify(d.name)) || `plan-${Date.now()}`;

  const { data: created, error } = await admin
    .from("packages")
    .insert({
      name: d.name,
      slug,
      tagline: d.tagline ?? null,
      description: d.description ?? null,
      price_cents: d.price_cents,
      currency: d.currency.toLowerCase(),
      interval: d.interval,
      trial_days: d.trial_days,
      min_listings: d.min_listings,
      max_listings: d.max_listings,
      max_images: d.max_images,
      requires_approval: d.requires_approval,
      allows_featured: d.allows_featured,
      priority_rank: d.priority_rank,
      badge_label: d.badge_label ?? null,
      badge_color: d.badge_color ?? null,
      features: d.features,
      is_active: d.is_active,
      is_public: d.is_public,
      is_default: d.is_default,
    })
    .select("id")
    .single();
  if (error || !created) {
    const dup = error?.code === "23505";
    return {
      ok: false,
      error: dup ? "A package with that slug already exists." : "Couldn't create the package.",
    };
  }

  if (d.is_default) await clearOtherDefaults(admin, created.id);

  // Stripe sync.
  const sync = await syncStripeProductPrice({
    id: created.id,
    kind: "package",
    name: d.name,
    description: d.description,
    priceCents: d.price_cents,
    currency: d.currency,
    interval: d.interval,
    productId: null,
    priceId: null,
  });
  if (sync.productId || sync.priceId) {
    await admin
      .from("packages")
      .update({ stripe_product_id: sync.productId, stripe_price_id: sync.priceId })
      .eq("id", created.id);
  }

  await logAudit({
    action: "package.create",
    entityType: "package",
    entityId: created.id,
    after: { name: d.name, price_cents: d.price_cents, interval: d.interval },
  });

  revalidatePath("/admin/packages");
  return { ok: true, id: created.id, warning: sync.warning };
}

export async function updatePackageAction(
  id: string,
  input: PackageInput,
): Promise<PackageActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid package." };
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That package no longer exists." };

  const slug = d.slug?.trim() || before.slug;

  const { error } = await admin
    .from("packages")
    .update({
      name: d.name,
      slug,
      tagline: d.tagline ?? null,
      description: d.description ?? null,
      price_cents: d.price_cents,
      currency: d.currency.toLowerCase(),
      interval: d.interval,
      trial_days: d.trial_days,
      min_listings: d.min_listings,
      max_listings: d.max_listings,
      max_images: d.max_images,
      requires_approval: d.requires_approval,
      allows_featured: d.allows_featured,
      priority_rank: d.priority_rank,
      badge_label: d.badge_label ?? null,
      badge_color: d.badge_color ?? null,
      features: d.features,
      is_active: d.is_active,
      is_public: d.is_public,
      is_default: d.is_default,
    })
    .eq("id", id);
  if (error) {
    const dup = error.code === "23505";
    return {
      ok: false,
      error: dup ? "A package with that slug already exists." : "Couldn't save the package.",
    };
  }

  if (d.is_default) await clearOtherDefaults(admin, id);

  const sync = await syncStripeProductPrice({
    id,
    kind: "package",
    name: d.name,
    description: d.description,
    priceCents: d.price_cents,
    currency: d.currency,
    interval: d.interval,
    productId: before.stripe_product_id,
    priceId: before.stripe_price_id,
  });
  await admin
    .from("packages")
    .update({ stripe_product_id: sync.productId, stripe_price_id: sync.priceId })
    .eq("id", id);

  await logAudit({
    action: "package.update",
    entityType: "package",
    entityId: id,
    before: { name: before.name, price_cents: before.price_cents, interval: before.interval },
    after: { name: d.name, price_cents: d.price_cents, interval: d.interval },
    meta: sync.priceChanged
      ? { price_changed: true, archived_price: sync.archivedPriceId }
      : undefined,
  });

  revalidatePath("/admin/packages");
  revalidatePath(`/admin/packages/${id}`);
  return { ok: true, id, warning: sync.warning };
}

export async function reorderPackagesAction(
  orderedIds: string[],
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();

  await Promise.all(
    parsed.data.map((id, index) =>
      admin.from("packages").update({ sort_order: index }).eq("id", id),
    ),
  );

  await logAudit({
    action: "package.reorder",
    entityType: "package",
    meta: { order: parsed.data },
  });
  revalidatePath("/admin/packages");
  return { ok: true, message: "Order saved." };
}

export async function archivePackageAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid package." };
  const admin = createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("stripe_product_id, stripe_price_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!pkg) return { ok: false, error: "That package no longer exists." };

  const { error } = await admin
    .from("packages")
    .update({ is_active: false, is_public: false, is_default: false })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't archive that package." };

  await archiveStripeProduct(pkg.stripe_product_id, pkg.stripe_price_id);

  await logAudit({ action: "package.archive", entityType: "package", entityId: id });
  revalidatePath("/admin/packages");
  return { ok: true, message: `${pkg.name} archived.` };
}

export async function deletePackageAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid package." };
  const admin = createAdminClient();

  const subs = await activeSubscriberCount(id);
  if (subs > 0) {
    return {
      ok: false,
      error: `${subs} active subscriber${subs === 1 ? "" : "s"} on this package. Archive it instead so they keep billing.`,
    };
  }

  const { data: pkg } = await admin
    .from("packages")
    .select("stripe_product_id, stripe_price_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!pkg) return { ok: false, error: "That package no longer exists." };

  const { error } = await admin.from("packages").delete().eq("id", id);
  if (error) {
    // Most likely a listing still references it.
    return {
      ok: false,
      error:
        "Listings still reference this package, so it can't be deleted. Archive it instead.",
    };
  }

  await archiveStripeProduct(pkg.stripe_product_id, pkg.stripe_price_id);

  await logAudit({
    action: "package.delete",
    entityType: "package",
    entityId: id,
    meta: { name: pkg.name },
  });
  revalidatePath("/admin/packages");
  return { ok: true, message: `${pkg.name} deleted.` };
}

export async function reconcilePackageAction(
  id: string,
): Promise<{ ok: boolean; messages: string[] }> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, messages: ["Invalid package."] };
  }
  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!pkg) return { ok: false, messages: ["That package no longer exists."] };

  const report = await reconcileStripe({
    id: pkg.id,
    kind: "package",
    name: pkg.name,
    description: pkg.description,
    priceCents: pkg.price_cents,
    currency: pkg.currency,
    interval: pkg.interval,
    productId: pkg.stripe_product_id,
    priceId: pkg.stripe_price_id,
  });

  await logAudit({
    action: "package.reconcile",
    entityType: "package",
    entityId: id,
    meta: { messages: report.messages },
  });
  revalidatePath(`/admin/packages/${id}`);
  return report;
}
