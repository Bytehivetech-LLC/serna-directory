import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type Provider = "sendgrid" | "recaptcha" | "google_maps" | "stripe";

type Resolved = {
  publicConfig: Record<string, unknown>;
  /** Decrypted secret, in memory only — NEVER surface this to a client. */
  secret: string | null;
  enabled: boolean;
  hint: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

async function writeLastError(provider: string, message: string) {
  try {
    const admin = createAdminClient();
    await admin
      .from("integration_settings")
      .update({ last_error_at: new Date().toISOString(), last_error_message: message })
      .eq("provider", provider);
  } catch {
    /* best-effort */
  }
}

/**
 * Load + decrypt an integration's config. Reads with the service-role client,
 * decrypts in memory. A decrypt failure never throws the page — it records the
 * error and returns a null secret so the caller falls back to env.
 * Cached per request only.
 */
export const getIntegrationConfig = cache(async (provider: Provider): Promise<Resolved> => {
  const empty: Resolved = {
    publicConfig: {},
    secret: null,
    enabled: false,
    hint: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("integration_settings")
      .select("public_config, secret_ciphertext, secret_hint, is_enabled, last_success_at, last_error_at, last_error_message")
      .eq("provider", provider)
      .maybeSingle();
    if (!data) return empty;

    let secret: string | null = null;
    if (data.secret_ciphertext) {
      try {
        const { decryptSecret } = await import("./crypto");
        secret = decryptSecret(data.secret_ciphertext);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[secrets] decrypt failed for ${provider}: ${message}`);
        await writeLastError(provider, `decrypt failed: ${message}`);
        secret = null;
      }
    }

    return {
      publicConfig: (data.public_config as Record<string, unknown>) ?? {},
      secret,
      enabled: data.is_enabled,
      hint: data.secret_hint,
      lastSuccessAt: data.last_success_at,
      lastErrorAt: data.last_error_at,
      lastErrorMessage: data.last_error_message,
    };
  } catch (err) {
    console.warn(`[secrets] load failed for ${provider}:`, err);
    return empty;
  }
});

/** Record a successful call so the panel can show "last used". */
export async function markIntegrationSuccess(provider: Provider): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("integration_settings")
      .update({ last_success_at: new Date().toISOString(), last_error_message: null })
      .eq("provider", provider);
  } catch {
    /* best-effort */
  }
}

/* ---------------------------------------------------------- narrow helpers -- */

/** SendGrid API key: stored value first, env fallback. */
export async function getSendgridKey(): Promise<string | null> {
  const cfg = await getIntegrationConfig("sendgrid");
  return cfg.secret ?? process.env.SENDGRID_API_KEY ?? null;
}

export async function getSendgridFrom(): Promise<{ email: string | null; name: string }> {
  const cfg = await getIntegrationConfig("sendgrid");
  const pc = cfg.publicConfig as { from_email?: string; from_name?: string };
  return {
    email: pc.from_email ?? process.env.SENDGRID_FROM_EMAIL ?? null,
    name: pc.from_name ?? process.env.SENDGRID_FROM_NAME ?? "Serna Educational Services",
  };
}

export async function getRecaptchaSecret(): Promise<string | null> {
  const cfg = await getIntegrationConfig("recaptcha");
  return cfg.secret ?? process.env.RECAPTCHA_SECRET_KEY ?? null;
}

export async function getRecaptchaPublicConfig(): Promise<{
  siteKey: string | null;
  minScore: number;
  reviewScore: number;
  guardedForms: string[];
  enabled: boolean;
}> {
  const cfg = await getIntegrationConfig("recaptcha");
  const pc = cfg.publicConfig as {
    site_key?: string;
    min_score?: number;
    review_score?: number;
    guarded_forms?: string[];
  };
  return {
    siteKey: pc.site_key ?? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? null,
    minScore: typeof pc.min_score === "number" ? pc.min_score : 0.5,
    reviewScore: typeof pc.review_score === "number" ? pc.review_score : 0.3,
    guardedForms: Array.isArray(pc.guarded_forms) ? pc.guarded_forms : ["list_program", "contact", "register"],
    enabled: cfg.enabled,
  };
}

export async function getMapsPublicConfig(): Promise<{
  browserKey: string | null;
  center: { lat: number; lng: number };
  zoom: number;
}> {
  const cfg = await getIntegrationConfig("google_maps");
  const pc = cfg.publicConfig as {
    browser_key?: string;
    center?: { lat?: number; lng?: number };
    zoom?: number;
  };
  return {
    browserKey: pc.browser_key ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null,
    center: { lat: pc.center?.lat ?? 33.4484, lng: pc.center?.lng ?? -112.074 },
    zoom: typeof pc.zoom === "number" ? pc.zoom : 10,
  };
}
