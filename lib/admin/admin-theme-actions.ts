"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { enqueueAssetDeletion, pathFromPublicUrl } from "@/lib/assets/lifecycle";
import { THEME_COLOR_KEYS } from "@/lib/theme/defaults";
import {
  ADMIN_EXTRA_KEYS,
  defaultAdminTheme,
  type AdminTheme,
} from "@/lib/theme/admin-defaults";
import { mergeTheme } from "@/lib/theme/get-theme";
import { contrastRatio } from "@/lib/theme/contrast";
import { isAllowedFont } from "@/lib/theme/fonts-list";

const ASSETS_BUCKET = "site-assets";
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

const allKeys = [...THEME_COLOR_KEYS, ...ADMIN_EXTRA_KEYS];
const colorShape = Object.fromEntries(allKeys.map((k) => [k, hex])) as Record<
  (typeof allKeys)[number],
  typeof hex
>;

const adminThemeSchema = z.object({
  ...colorShape,
  radius: z
    .string()
    .regex(/^\d{1,2}px$/, "Radius like 16px.")
    .refine((r) => {
      const n = parseInt(r, 10);
      return n >= 0 && n <= 24;
    }, "Radius must be 0–24px."),
  fontDisplay: z.string().refine(isAllowedFont, "That display font isn't allowed."),
  fontBody: z.string().refine(isAllowedFont, "That body font isn't allowed."),
});

export type AdminThemeResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; failures?: { label: string; ratio: number; min: number }[] };

function parse(input: unknown): AdminTheme | null {
  const parsed = adminThemeSchema.safeParse(input);
  return parsed.success ? (parsed.data as AdminTheme) : null;
}

/** WCAG AA on the pairs that matter most for a themed sidebar. */
function adminContrastFailures(t: AdminTheme) {
  const pairs = [
    { label: "Sidebar text on sidebar", fg: t.sidebarText, bg: t.sidebarBg, min: 4.5 },
    { label: "Active item text on active", fg: t.sidebarActiveText, bg: t.sidebarActiveBg, min: 4.5 },
    { label: "Brand-bar text on brand bar", fg: t.brandBarText, bg: t.brandBarBg, min: 4.5 },
    { label: "Ink on card", fg: t.ink, bg: t.card, min: 4.5 },
  ];
  return pairs
    .map((p) => ({ label: p.label, ratio: Math.round(contrastRatio(p.fg, p.bg) * 100) / 100, min: p.min }))
    .filter((p) => p.ratio < p.min);
}

async function writeAdminTheme(theme: AdminTheme): Promise<string | null> {
  const admin = createAdminClient();
  const session = await getSession();
  const { error } = await admin
    .from("site_settings")
    .upsert({ key: "admin_theme", value: theme as never, updated_by: session?.user?.id ?? null });
  if (error) {
    console.error("[admin-theme] write rejected:", error.message);
    return error.message || "The database rejected that admin-theme write.";
  }
  return null;
}

export async function publishAdminThemeAction(input: unknown): Promise<AdminThemeResult> {
  await requireAdmin();
  const theme = parse(input);
  if (!theme) return { ok: false, error: "Some colours or fonts are invalid." };

  const failures = adminContrastFailures(theme);
  if (failures.length) {
    return {
      ok: false,
      error: "Contrast too low to publish. Fix these pairs first.",
      failures,
    };
  }

  const err = await writeAdminTheme(theme);
  if (err) return { ok: false, error: err };
  await logAudit({ action: "admin_theme.publish", entityType: "theme" });
  // Admin theme only affects the admin deployment — revalidate its layout.
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Admin theme published." };
}

export async function resetAdminThemeAction(): Promise<AdminThemeResult> {
  await requireAdmin();
  const err = await writeAdminTheme(defaultAdminTheme);
  if (err) return { ok: false, error: err };
  await logAudit({ action: "admin_theme.reset", entityType: "theme" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Admin theme reset to the default." };
}

/** Copy the public theme's palette into the admin theme, keeping sidebar keys. */
export async function copyPublicToAdminThemeAction(): Promise<AdminThemeResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "theme")
    .maybeSingle();
  const publicTheme = mergeTheme(defaultAdminTheme, (data?.value as Record<string, unknown>) ?? {});
  // publicTheme now has the public palette; keep the current admin sidebar keys.
  const { data: cur } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "admin_theme")
    .maybeSingle();
  const curAdmin = (cur?.value as Partial<AdminTheme>) ?? {};
  const merged: AdminTheme = {
    ...defaultAdminTheme,
    ...publicTheme,
    sidebarBg: curAdmin.sidebarBg ?? defaultAdminTheme.sidebarBg,
    sidebarText: curAdmin.sidebarText ?? defaultAdminTheme.sidebarText,
    sidebarActiveBg: curAdmin.sidebarActiveBg ?? defaultAdminTheme.sidebarActiveBg,
    sidebarActiveText: curAdmin.sidebarActiveText ?? defaultAdminTheme.sidebarActiveText,
    sidebarBorder: curAdmin.sidebarBorder ?? defaultAdminTheme.sidebarBorder,
    brandBarBg: curAdmin.brandBarBg ?? defaultAdminTheme.brandBarBg,
    brandBarText: curAdmin.brandBarText ?? defaultAdminTheme.brandBarText,
  };
  const err = await writeAdminTheme(merged);
  if (err) return { ok: false, error: err };
  await logAudit({ action: "admin_theme.copy_public", entityType: "theme" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Copied the public palette into the admin theme." };
}

/* ------------------------------------------------------------ admin logo --- */

export async function signAdminLogoUploadAction(
  ext: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  const safeExt = /^(png|jpg|jpeg|webp|svg)$/i.test(ext) ? ext.toLowerCase() : "png";
  const admin = createAdminClient();
  const path = `branding/admin-logo-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;
  const { data, error } = await admin.storage.from(ASSETS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't prepare the upload." };
  return { ok: true, path, token: data.token };
}

export async function setAdminLogoAction(path: string): Promise<AdminThemeResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: prev } = await admin.from("site_settings").select("value").eq("key", "admin_logo_url").maybeSingle();
  const oldPath = pathFromPublicUrl(typeof prev?.value === "string" ? prev.value : null, ASSETS_BUCKET);
  if (oldPath && oldPath !== path) {
    await enqueueAssetDeletion(admin, ASSETS_BUCKET, oldPath, "replaced:admin_logo_url");
  }
  const publicUrl = admin.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  const session = await getSession();
  await admin.from("site_settings").upsert({ key: "admin_logo_url", value: publicUrl as never, updated_by: session?.user?.id ?? null });
  await logAudit({ action: "admin_theme.logo", entityType: "settings" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Admin logo updated." };
}
