import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Read one or more rows from site_settings (key/value). Cached per request.
 * Returns a plain map of key -> value (jsonb). Missing keys are simply absent.
 */
export const getSettings = cache(
  async (keys: string[]): Promise<Record<string, unknown>> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", keys);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    } catch {
      return {};
    }
  },
);

/**
 * Read one setting together with its `updated_at`, so callers can cache-bust an
 * asset URL (e.g. the favicon) with `?v=<updated_at>`. Cached per request.
 */
export const getSettingWithMeta = cache(
  async (
    key: string,
  ): Promise<{ value: unknown; updatedAt: string | null }> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("site_settings")
        .select("value, updated_at")
        .eq("key", key)
        .maybeSingle();
      return {
        value: data?.value,
        updatedAt:
          data && "updated_at" in data
            ? ((data as { updated_at: string | null }).updated_at ?? null)
            : null,
      };
    } catch {
      return { value: undefined, updatedAt: null };
    }
  },
);
