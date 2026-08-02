import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

export type Slot = "head" | "body_start" | "body_end";
export type RenderScripts = Record<Slot, string[]>;

function appliesToPath(appliesTo: string, pathname: string): boolean {
  if (!appliesTo || appliesTo === "all") return true;
  if (appliesTo === "/") return pathname === "/";
  return pathname.startsWith(appliesTo);
}

/**
 * The active scripts to render for the current request, grouped by slot and
 * filtered by page + consent. Cached per request. Non-essential scripts only
 * appear once the visitor has consented to their group (when the banner is on).
 */
export const getScriptsForRender = cache(async (): Promise<RenderScripts> => {
  const empty: RenderScripts = { head: [], body_start: [], body_end: [] };

  // HARD GUARD: scripts never render on the admin deployment.
  if (process.env.APP_TARGET === "admin") return empty;

  try {
    const [h, c, settings] = await Promise.all([headers(), cookies(), getSettings(["consent_banner_enabled"])]);
    const pathname = (h.get("x-pathname") ?? "/").split("?")[0];
    const bannerOn = settings.consent_banner_enabled === true;

    const consentRaw = c.get("serna-consent")?.value ?? "";
    const accepted = new Set(["essential", ...consentRaw.split(",").map((s) => s.trim()).filter(Boolean)]);
    const groupAllowed = (group: string) => {
      if (group === "essential") return true;
      if (!bannerOn) return true; // no banner → nothing to gate on
      return accepted.has(group) || accepted.has("all");
    };

    const supabase = await createClient();
    const { data } = await supabase
      .from("site_scripts")
      .select("code, placement, applies_to, consent_group, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const out: RenderScripts = { head: [], body_start: [], body_end: [] };
    for (const s of data ?? []) {
      if (!s.code) continue;
      if (!appliesToPath(s.applies_to, pathname)) continue;
      if (!groupAllowed(s.consent_group)) continue;
      const slot = (["head", "body_start", "body_end"].includes(s.placement) ? s.placement : "body_end") as Slot;
      out[slot].push(s.code);
    }
    return out;
  } catch {
    return empty;
  }
});
