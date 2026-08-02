"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession, requireRecentMFA } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { getRecaptchaSecret } from "@/lib/secrets/resolve";
import { sendEmail } from "@/lib/email/sendgrid";

export type IntegrationResult =
  | { ok: true; message?: string; score?: number }
  | { ok: false; error: string; mfaRequired?: boolean };

/** Persist an integration row's public config and (optionally) a new secret. A
 * secret write requires a recent MFA challenge. The secret VALUE is never logged
 * or returned — only the fact that it changed. */
async function persistIntegration(opts: {
  provider: string;
  label: string;
  publicConfig: Record<string, unknown>;
  newSecret?: string | null;
  enabled?: boolean;
}): Promise<IntegrationResult> {
  const admin = createAdminClient();
  const session = await getSession();

  const row: Record<string, unknown> = {
    provider: opts.provider,
    label: opts.label,
    public_config: opts.publicConfig,
  };
  if (typeof opts.enabled === "boolean") row.is_enabled = opts.enabled;

  let secretChanged = false;
  if (opts.newSecret) {
    const mfa = await requireRecentMFA();
    if (!mfa.ok) return { ok: false, error: "Confirm your identity to save a secret.", mfaRequired: true };
    try {
      // Lazy import so a missing SECRETS_ENCRYPTION_KEY only errors when a
      // secret is actually written, not at build/module-load time.
      const { encryptSecret, secretHint } = await import("@/lib/secrets/crypto");
      row.secret_ciphertext = encryptSecret(opts.newSecret);
      row.secret_hint = secretHint(opts.newSecret);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Encryption failed." };
    }
    row.secret_updated_at = new Date().toISOString();
    row.secret_updated_by = session?.user?.id ?? null;
    secretChanged = true;
  }

  const { error } = await admin.from("integration_settings").upsert(row, { onConflict: "provider" });
  if (error) return { ok: false, error: "Couldn't save that integration." };

  await logAudit({
    action: "integration.save",
    entityType: "integration",
    entityId: opts.provider,
    meta: { secret_changed: secretChanged, enabled: opts.enabled },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved." };
}

/* -------------------------------------------------------------- sendgrid --- */

const sendgridSchema = z.object({
  from_email: z.string().trim().email().max(200),
  from_name: z.string().trim().min(1).max(120),
  recipients: z.array(z.string().trim().email()).max(20).default([]),
  api_key: z.string().trim().optional(),
  enabled: z.boolean().default(true),
});

export async function saveSendgridAction(input: unknown): Promise<IntegrationResult> {
  await requireAdmin();
  const parsed = sendgridSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;

  let newSecret: string | null = null;
  if (d.api_key) {
    if (!d.api_key.startsWith("SG.")) {
      return { ok: false, error: "That doesn't look like a SendGrid key — they start with “SG.”." };
    }
    if (/\s/.test(d.api_key)) return { ok: false, error: "The key has whitespace — check for a paste error." };
    newSecret = d.api_key;
  }

  return persistIntegration({
    provider: "sendgrid",
    label: "SendGrid",
    publicConfig: { from_email: d.from_email, from_name: d.from_name, recipients: d.recipients },
    newSecret,
    enabled: d.enabled,
  });
}

export async function testSendgridAction(): Promise<IntegrationResult> {
  await requireAdmin();
  const session = await getSession();
  const to = session?.user?.email;
  if (!to) return { ok: false, error: "Your account has no email." };
  const result = await sendEmail({
    to,
    subject: "Serna integration test",
    html: "<p>Your SendGrid integration works.</p>",
    text: "Your SendGrid integration works.",
  });
  if (result.status === "failed") return { ok: false, error: "Send failed — check the key." };
  return { ok: true, message: result.status === "skipped" ? "Mail isn't configured." : `Test sent to ${to}.` };
}

/* ------------------------------------------------------------- recaptcha --- */

const recaptchaSchema = z.object({
  site_key: z.string().trim().max(100).optional(),
  min_score: z.number().min(0).max(1),
  review_score: z.number().min(0).max(1),
  guarded_forms: z.array(z.string()).max(20).default([]),
  secret_key: z.string().trim().optional(),
  enabled: z.boolean().default(true),
});

export async function saveRecaptchaAction(input: unknown): Promise<IntegrationResult> {
  await requireAdmin();
  const parsed = recaptchaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;

  let newSecret: string | null = null;
  if (d.secret_key) {
    if (d.secret_key.length !== 40 || /\s/.test(d.secret_key)) {
      return { ok: false, error: "reCAPTCHA secret keys are 40 characters with no spaces." };
    }
    newSecret = d.secret_key;
  }

  return persistIntegration({
    provider: "recaptcha",
    label: "Google reCAPTCHA v3",
    publicConfig: {
      site_key: d.site_key ?? "",
      min_score: d.min_score,
      review_score: d.review_score,
      guarded_forms: d.guarded_forms,
    },
    newSecret,
    enabled: d.enabled,
  });
}

export async function testRecaptchaAction(token: string): Promise<IntegrationResult> {
  await requireAdmin();
  const secret = await getRecaptchaSecret();
  if (!secret) return { ok: false, error: "No reCAPTCHA secret configured." };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
    if (!data.success) return { ok: false, error: `Verification failed: ${(data["error-codes"] ?? []).join(", ") || "unknown"}` };
    return { ok: true, message: `Verified — score ${data.score ?? "?"}.`, score: data.score };
  } catch {
    return { ok: false, error: "Couldn't reach reCAPTCHA." };
  }
}

/* ----------------------------------------------------------------- maps --- */

const mapsSchema = z.object({
  browser_key: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoom: z.number().int().min(1).max(20),
  enabled: z.boolean().default(true),
});

export async function saveMapsAction(input: unknown): Promise<IntegrationResult> {
  await requireAdmin();
  const parsed = mapsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  // Browser key is public (NEXT_PUBLIC-style) — stored in public_config, no secret.
  return persistIntegration({
    provider: "google_maps",
    label: "Google Maps",
    publicConfig: { browser_key: d.browser_key ?? "", center: { lat: d.lat, lng: d.lng }, zoom: d.zoom },
    enabled: d.enabled,
  });
}

export async function testMapsAction(browserKey: string): Promise<IntegrationResult> {
  await requireAdmin();
  const key = browserKey.trim();
  if (!key) return { ok: false, error: "Enter a browser key first." };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent("Phoenix, AZ")}&key=${encodeURIComponent(key)}`,
    );
    const data = (await res.json()) as { status: string; results?: { formatted_address: string }[] };
    if (data.status !== "OK") return { ok: false, error: `Geocode returned ${data.status}.` };
    return { ok: true, message: `Geocoded: ${data.results?.[0]?.formatted_address ?? "OK"}.` };
  } catch {
    return { ok: false, error: "Couldn't reach the Maps API." };
  }
}

/* --------------------------------------------------------------- toggle --- */

export async function toggleIntegrationAction(provider: string, enabled: boolean): Promise<IntegrationResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("integration_settings").update({ is_enabled: enabled }).eq("provider", provider);
  if (error) return { ok: false, error: "Couldn't update that." };
  await logAudit({ action: "integration.toggle", entityType: "integration", entityId: provider, meta: { enabled } });
  revalidatePath("/admin/settings");
  return { ok: true };
}
