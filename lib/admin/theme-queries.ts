import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { defaultTheme, type Theme } from "@/lib/theme/defaults";
import { mergeTheme } from "@/lib/theme/get-theme";
import { BUILTIN_PRESETS, type ThemePreset } from "@/lib/theme/presets";

function asTheme(value: unknown): Theme | null {
  if (!value || typeof value !== "object") return null;
  return mergeTheme(defaultTheme, value as Record<string, unknown>);
}

export type ThemeEditorData = {
  draft: Theme;
  published: Theme;
  presets: ThemePreset[];
  hasDraft: boolean;
};

export async function getThemeEditorData(): Promise<ThemeEditorData> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("key, value")
    .in("key", ["theme", "theme_draft", "theme_presets"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));

  const published = asTheme(map.get("theme")) ?? defaultTheme;
  const draftRaw = asTheme(map.get("theme_draft"));

  const storedPresets: ThemePreset[] = Array.isArray(map.get("theme_presets"))
    ? (map.get("theme_presets") as unknown[])
        .map((p) => {
          const r = p as Record<string, unknown>;
          const theme = asTheme(r.theme);
          if (!theme || typeof r.id !== "string" || typeof r.name !== "string") return null;
          return { id: r.id, name: r.name, theme };
        })
        .filter((p): p is ThemePreset => Boolean(p))
    : [];

  return {
    draft: draftRaw ?? published,
    published,
    presets: [...BUILTIN_PRESETS, ...storedPresets],
    hasDraft: Boolean(draftRaw),
  };
}
