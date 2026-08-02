"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { defaultTheme, THEME_COLOR_KEYS, type Theme } from "@/lib/theme/defaults";
import { mergeTheme } from "@/lib/theme/get-theme";
import { blockingFailures } from "@/lib/theme/contrast";
import { isAllowedFont } from "@/lib/theme/fonts-list";
import { BUILTIN_PRESETS } from "@/lib/theme/presets";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

const colorShape = Object.fromEntries(THEME_COLOR_KEYS.map((k) => [k, hex])) as Record<
  (typeof THEME_COLOR_KEYS)[number],
  typeof hex
>;

const themeSchema = z.object({
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

export type ThemeActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; failures?: { label: string; ratio: number; min: number }[] };

function parseTheme(input: unknown): Theme | null {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data as Theme;
}

async function writeSetting(key: string, value: unknown) {
  const admin = createAdminClient();
  const session = await getSession();
  await admin
    .from("site_settings")
    .upsert({ key, value: value as never, updated_by: session?.user?.id ?? null });
}

/** Save the working palette to the draft — never straight to the live theme. */
export async function saveThemeDraftAction(input: unknown): Promise<ThemeActionResult> {
  await requireAdmin();
  const theme = parseTheme(input);
  if (!theme) return { ok: false, error: "Some colours or fonts are invalid." };
  await writeSetting("theme_draft", theme);
  await logAudit({ action: "theme.draft_save", entityType: "theme" });
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Publish the draft to the live theme — blocked by the contrast guard. */
export async function publishThemeAction(input: unknown): Promise<ThemeActionResult> {
  await requireAdmin();
  const theme = parseTheme(input);
  if (!theme) return { ok: false, error: "Some colours or fonts are invalid." };

  const failures = blockingFailures(theme);
  if (failures.length) {
    return {
      ok: false,
      error: "Contrast too low to publish. Fix these pairs first.",
      failures: failures.map((f) => ({ label: f.label, ratio: f.ratio, min: f.min })),
    };
  }

  await writeSetting("theme", theme);
  await writeSetting("theme_draft", theme);
  await logAudit({ action: "theme.publish", entityType: "theme", after: theme as unknown as Record<string, unknown> });

  // The theme lives in the root layout — revalidate everything public.
  revalidatePath("/", "layout");
  return { ok: true, message: "Theme published. The whole site now uses it." };
}

export async function discardDraftAction(): Promise<ThemeActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("site_settings").delete().eq("key", "theme_draft");
  await logAudit({ action: "theme.draft_discard", entityType: "theme" });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Draft discarded." };
}

export async function resetDraftToDefaultAction(): Promise<ThemeActionResult> {
  await requireAdmin();
  await writeSetting("theme_draft", defaultTheme);
  await logAudit({ action: "theme.reset_default", entityType: "theme" });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Draft reset to the Serna default." };
}

/* --------------------------------------------------------------- presets --- */

async function readPresets(): Promise<{ id: string; name: string; theme: Theme }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "theme_presets")
    .maybeSingle();
  if (!Array.isArray(data?.value)) return [];
  return (data!.value as unknown[])
    .map((p) => {
      const r = p as Record<string, unknown>;
      const theme = parseTheme(r.theme);
      if (!theme || typeof r.id !== "string" || typeof r.name !== "string") return null;
      return { id: r.id, name: r.name, theme };
    })
    .filter((p): p is { id: string; name: string; theme: Theme } => Boolean(p));
}

export async function savePresetAction(name: string, input: unknown): Promise<ThemeActionResult> {
  await requireAdmin();
  const nm = z.string().trim().min(1).max(60).safeParse(name);
  if (!nm.success) return { ok: false, error: "Give the preset a name." };
  const theme = parseTheme(input);
  if (!theme) return { ok: false, error: "Some colours or fonts are invalid." };

  const presets = await readPresets();
  presets.push({ id: crypto.randomUUID(), name: nm.data, theme });
  await writeSetting("theme_presets", presets);
  await logAudit({ action: "theme.preset_save", entityType: "theme", meta: { name: nm.data } });
  revalidatePath("/admin/settings");
  return { ok: true, message: `Saved preset “${nm.data}”.` };
}

export async function applyPresetAction(presetId: string): Promise<ThemeActionResult> {
  await requireAdmin();
  const builtin = BUILTIN_PRESETS.find((p) => p.id === presetId);
  const theme = builtin?.theme ?? (await readPresets()).find((p) => p.id === presetId)?.theme;
  if (!theme) return { ok: false, error: "That preset no longer exists." };
  await writeSetting("theme_draft", theme);
  await logAudit({ action: "theme.preset_apply", entityType: "theme", meta: { preset: presetId } });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Preset applied to the draft." };
}

export async function deletePresetAction(presetId: string): Promise<ThemeActionResult> {
  await requireAdmin();
  if (BUILTIN_PRESETS.some((p) => p.id === presetId)) {
    return { ok: false, error: "Built-in presets can't be deleted." };
  }
  const presets = (await readPresets()).filter((p) => p.id !== presetId);
  await writeSetting("theme_presets", presets);
  await logAudit({ action: "theme.preset_delete", entityType: "theme", meta: { preset: presetId } });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Preset deleted." };
}
