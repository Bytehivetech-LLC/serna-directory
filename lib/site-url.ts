import "server-only";
import { cache } from "react";

export type UrlRung =
  | "from setting"
  | "from environment variable"
  | "from Vercel"
  | "falling back to localhost";

let warnedSite = false;
let warnedAdmin = false;

function clean(u: string): string {
  return u.trim().replace(/\/+$/, "");
}

function isLocal(u: string): boolean {
  return /localhost|127\.0\.0\.1/.test(u);
}

/**
 * Env-only resolver (no DB), safe in module scope and edge runtime:
 *   NEXT_PUBLIC_SITE_URL → https://$VERCEL_URL (when VERCEL_ENV set) → localhost.
 * In production, warns ONCE per process if it lands on localhost.
 */
export function resolveSiteUrlFromEnv(): { url: string; rung: UrlRung } {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return { url: clean(env), rung: "from environment variable" };
  if (process.env.VERCEL_ENV && process.env.VERCEL_URL) {
    return { url: clean(`https://${process.env.VERCEL_URL}`), rung: "from Vercel" };
  }
  const fallback = "http://localhost:3000";
  if (process.env.NODE_ENV === "production" && !warnedSite) {
    warnedSite = true;
    console.warn("[site-url] resolved to localhost in production — set NEXT_PUBLIC_SITE_URL / the site_url setting.");
  }
  return { url: fallback, rung: "falling back to localhost" };
}

function resolveAdminUrlFromEnv(): { url: string; rung: UrlRung } {
  const env = process.env.NEXT_PUBLIC_ADMIN_URL?.trim();
  if (env) return { url: clean(env), rung: "from environment variable" };
  const site = resolveSiteUrlFromEnv();
  if (process.env.NODE_ENV === "production" && isLocal(site.url) && !warnedAdmin) {
    warnedAdmin = true;
    console.warn("[site-url] admin URL resolved to localhost in production — set the admin_url setting.");
  }
  return site;
}

/** Sync drop-in for `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`. */
export function siteUrl(): string {
  return resolveSiteUrlFromEnv().url;
}

async function readSetting(key: string): Promise<string | null> {
  try {
    // Local import avoids pulling the server client into the edge bundle.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const v = data?.value;
    return typeof v === "string" && v.trim() ? clean(v) : null;
  } catch {
    return null;
  }
}

/** DB-aware, cached per request: the `site_url` setting wins, else the env ladder. */
export const getSiteUrl = cache(async (): Promise<string> => {
  const setting = await readSetting("site_url");
  return setting ?? resolveSiteUrlFromEnv().url;
});

export const getAdminUrl = cache(async (): Promise<string> => {
  const setting = await readSetting("admin_url");
  return setting ?? resolveAdminUrlFromEnv().url;
});

/** Which rung the resolver used, for the admin diagnostics panel. */
export const getSiteUrlResolution = cache(async (): Promise<{ url: string; rung: UrlRung }> => {
  const setting = await readSetting("site_url");
  if (setting) return { url: setting, rung: "from setting" };
  return resolveSiteUrlFromEnv();
});

export const getAdminUrlResolution = cache(async (): Promise<{ url: string; rung: UrlRung }> => {
  const setting = await readSetting("admin_url");
  if (setting) return { url: setting, rung: "from setting" };
  return resolveAdminUrlFromEnv();
});

/** Join a base and path with exactly one slash. */
export function absoluteUrl(path: string, base?: string): string {
  const b = clean(base ?? siteUrl());
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}
