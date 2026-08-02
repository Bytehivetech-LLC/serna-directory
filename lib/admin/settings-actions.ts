"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/sendgrid";
import type { AdminActionResult } from "./users-actions";

const ASSETS_BUCKET = "site-assets";

async function writeSettings(entries: Record<string, unknown>, action: string) {
  const admin = createAdminClient();
  const session = await getSession();
  const rows = Object.entries(entries).map(([key, value]) => ({
    key,
    value: value as never,
    updated_by: session?.user?.id ?? null,
  }));
  await admin.from("site_settings").upsert(rows);
  await logAudit({ action, entityType: "settings", meta: { keys: Object.keys(entries) } });
}

/* -------------------------------------------------------------- branding --- */

const brandingSchema = z.object({
  site_name: z.string().trim().min(1).max(120),
  logo_mark_letter: z.string().trim().max(2),
  hero_heading: z.string().trim().max(200).optional().nullable(),
  hero_subheading: z.string().trim().max(400).optional().nullable(),
  footer_text: z.string().trim().max(600).optional().nullable(),
});

export async function updateBrandingAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  await writeSettings(
    {
      site_name: d.site_name,
      logo_mark_letter: d.logo_mark_letter || d.site_name.slice(0, 1).toUpperCase(),
      hero_heading: d.hero_heading ?? "",
      hero_subheading: d.hero_subheading ?? "",
      footer_text: d.footer_text ?? "",
    },
    "settings.branding",
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Branding saved." };
}

export async function signBrandingUploadAction(
  kind: "logo" | "favicon",
  ext: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  const safeExt = /^(png|jpg|jpeg|webp|svg|ico)$/i.test(ext) ? ext.toLowerCase() : "png";
  const admin = createAdminClient();
  const path = `branding/${kind}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;
  const { data, error } = await admin.storage.from(ASSETS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't prepare the upload." };
  return { ok: true, path, token: data.token };
}

export async function setBrandingImageAction(
  kind: "logo" | "favicon",
  path: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const publicUrl = admin.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  await writeSettings({ [kind === "logo" ? "logo_url" : "favicon_url"]: publicUrl }, "settings.branding_image");
  revalidatePath("/", "layout");
  return { ok: true, message: `${kind === "logo" ? "Logo" : "Favicon"} updated.` };
}

/* ------------------------------------------------------------- directory --- */

const directorySchema = z.object({
  listings_per_page: z.number().int().min(6).max(60),
  default_sort: z.enum(["relevance", "newest", "name", "featured"]),
  review_sla_days: z.number().int().min(0).max(30),
  allow_pending_direct_link: z.boolean(),
});

export async function updateDirectoryAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = directorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await writeSettings({ ...parsed.data }, "settings.directory");
  revalidatePath("/");
  return { ok: true, message: "Directory settings saved." };
}

/* ------------------------------------------------------------------ maps --- */

const mapsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoom: z.number().int().min(1).max(20),
  google_maps_browser_key: z.string().trim().max(200).optional().nullable(),
});

export async function updateMapsAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = mapsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  await writeSettings(
    {
      default_map_center: { lat: d.lat, lng: d.lng, zoom: d.zoom },
      google_maps_browser_key: d.google_maps_browser_key ?? "",
    },
    "settings.maps",
  );
  revalidatePath("/");
  return { ok: true, message: "Map settings saved." };
}

/* ----------------------------------------------------------------- email --- */

const emailSchema = z.object({
  email_from_name: z.string().trim().min(1).max(120),
  email_from_address: z.string().trim().email().max(200),
  admin_notification_recipients: z.string().trim().max(600),
});

export async function updateEmailAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const recipients = d.admin_notification_recipients
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await writeSettings(
    {
      email_from_name: d.email_from_name,
      email_from_address: d.email_from_address,
      admin_notification_recipients: recipients,
    },
    "settings.email",
  );
  return { ok: true, message: "Email settings saved." };
}

export async function sendTestEmailAction(): Promise<AdminActionResult> {
  await requireAdmin();
  const session = await getSession();
  const to = session?.user?.email;
  if (!to) return { ok: false, error: "Your account has no email." };
  const result = await sendEmail({
    to,
    subject: "Serna test email",
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#201f3a"><p>This is a test email from your Serna admin. If you're reading this, delivery works.</p></div>`,
    text: "This is a test email from your Serna admin. If you're reading this, delivery works.",
  });
  await logAudit({ action: "settings.test_email", entityType: "settings", meta: { to, delivery: result.status } });
  if (result.status === "failed") return { ok: false, error: "Couldn't send — check the SendGrid key." };
  return {
    ok: true,
    message: result.status === "skipped" ? "Mail isn't configured in this environment." : `Test email sent to ${to}.`,
  };
}

/* ------------------------------------------------------------ navigation --- */

const menuItemSchema = z.object({
  location: z.enum(["header", "footer"]),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(300),
  opens_new_tab: z.boolean().default(false),
  parent_id: z.string().uuid().nullable().default(null),
});

export async function createMenuItemAction(input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const admin = createAdminClient();
  const { data: max } = await admin
    .from("menu_items")
    .select("sort_order")
    .eq("location", d.location)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin.from("menu_items").insert({
    location: d.location,
    label: d.label,
    url: d.url,
    opens_new_tab: d.opens_new_tab,
    parent_id: d.parent_id,
    sort_order: (max?.sort_order ?? -1) + 1,
    is_active: true,
  });
  if (error) return { ok: false, error: "Couldn't add the link." };
  await logAudit({ action: "menu.create", entityType: "menu_item" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Link added." };
}

export async function updateMenuItemAction(id: string, input: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid link." };
  const parsed = menuItemSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the fields." };
  const admin = createAdminClient();
  const { error } = await admin.from("menu_items").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the link." };
  await logAudit({ action: "menu.update", entityType: "menu_item", entityId: id });
  revalidatePath("/", "layout");
  return { ok: true, message: "Link saved." };
}

export async function toggleMenuItemAction(id: string, value: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid link." };
  const admin = createAdminClient();
  const { error } = await admin.from("menu_items").update({ is_active: value }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the link." };
  await logAudit({ action: "menu.toggle", entityType: "menu_item", entityId: id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderMenuItemsAction(ids: string[]): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const admin = createAdminClient();
  await Promise.all(parsed.data.map((id, i) => admin.from("menu_items").update({ sort_order: i }).eq("id", id)));
  await logAudit({ action: "menu.reorder", entityType: "menu_item" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMenuItemAction(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid link." };
  const admin = createAdminClient();
  await admin.from("menu_items").delete().eq("parent_id", id);
  const { error } = await admin.from("menu_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the link." };
  await logAudit({ action: "menu.delete", entityType: "menu_item", entityId: id });
  revalidatePath("/", "layout");
  return { ok: true, message: "Link deleted." };
}
