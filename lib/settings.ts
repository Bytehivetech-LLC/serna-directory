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
