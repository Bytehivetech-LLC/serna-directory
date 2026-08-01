import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { defaultTheme, type Theme } from "./defaults";

/**
 * Merge a loosely-typed record from the database over the default theme.
 * Only string values for known keys are accepted; everything else is ignored,
 * so a partial or partly-corrupt row still yields a complete, valid Theme.
 */
function mergeTheme(base: Theme, overrides: Record<string, unknown>): Theme {
  const out: Theme = { ...base };
  for (const key of Object.keys(base) as (keyof Theme)[]) {
    const value = overrides[key];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

/**
 * The single source of truth for the active theme, read once per request.
 *
 * Reads the `theme` row from site_settings with the public anon key (the row
 * is world-readable) and merges it over the defaults. Falls back to the
 * defaults whenever Supabase isn't configured, the row is missing, or the
 * value is malformed — the site must never render unstyled because of a bad
 * theme value.
 */
export const getTheme = cache(async (): Promise<Theme> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return defaultTheme;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "theme")
      .maybeSingle();

    if (error || !data || typeof data.value !== "object" || data.value === null) {
      return defaultTheme;
    }
    return mergeTheme(defaultTheme, data.value as Record<string, unknown>);
  } catch {
    return defaultTheme;
  }
});
