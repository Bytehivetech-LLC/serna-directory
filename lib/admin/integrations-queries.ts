import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { getStripeStatus, type StripeStatus } from "@/lib/stripe/status";

export type IntegrationPanel = {
  provider: string;
  label: string;
  enabled: boolean;
  publicConfig: Record<string, unknown>;
  hint: string | null;
  secretUpdatedAt: string | null;
  secretUpdatedByEmail: string | null;
  hasSecret: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

const LABELS: Record<string, string> = {
  sendgrid: "SendGrid",
  recaptcha: "Google reCAPTCHA v3",
  google_maps: "Google Maps",
  stripe: "Stripe",
};
const PROVIDERS = ["sendgrid", "recaptcha", "google_maps", "stripe"];

export async function getIntegrationsPanel(): Promise<{
  integrations: IntegrationPanel[];
  stripe: StripeStatus;
}> {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: rows }, stripe] = await Promise.all([
    admin
      .from("integration_settings")
      .select("provider, label, public_config, secret_hint, secret_ciphertext, secret_updated_at, secret_updated_by, is_enabled, last_success_at, last_error_at, last_error_message"),
    getStripeStatus(),
  ]);
  const byProvider = new Map((rows ?? []).map((r) => [r.provider, r]));

  const editorIds = Array.from(
    new Set((rows ?? []).map((r) => r.secret_updated_by).filter(Boolean)),
  ) as string[];
  const emails = new Map<string, string>();
  if (editorIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", editorIds);
    for (const p of profiles ?? []) emails.set(p.id, p.email);
  }

  const integrations: IntegrationPanel[] = PROVIDERS.map((provider) => {
    const r = byProvider.get(provider);
    return {
      provider,
      label: LABELS[provider] ?? provider,
      enabled: r?.is_enabled ?? false,
      publicConfig: (r?.public_config as Record<string, unknown>) ?? {},
      hint: r?.secret_hint ?? null,
      secretUpdatedAt: r?.secret_updated_at ?? null,
      secretUpdatedByEmail: r?.secret_updated_by ? emails.get(r.secret_updated_by) ?? null : null,
      hasSecret: Boolean(r?.secret_ciphertext),
      lastSuccessAt: r?.last_success_at ?? null,
      lastErrorAt: r?.last_error_at ?? null,
      lastErrorMessage: r?.last_error_message ?? null,
    };
  });

  return { integrations, stripe };
}
