import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENV_VARS = [
  "APP_TARGET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "SECRETS_ENCRYPTION_KEY",
  "CRON_SECRET",
  "REVALIDATE_SECRET",
  "RECAPTCHA_SECRET_KEY",
  "NEXT_PUBLIC_RECAPTCHA_SITE_KEY",
  "GOOGLE_GEOCODING_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
] as const;

const BUCKETS = ["listing-images", "site-assets", "avatars"] as const;

const RPCS: { name: string; args: Record<string, unknown> }[] = [
  { name: "listing_entitlements", args: { p_listing_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "search_listings", args: {} },
  { name: "hit_rate_limit", args: { p_bucket: "healthcheck", p_limit: 1, p_window_seconds: 1 } },
  { name: "increment_listing_view", args: { p_listing_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "create_inquiry", args: {} },
  { name: "admin_list_listings", args: {} },
  { name: "admin_list_users", args: {} },
];

type Admin = ReturnType<typeof createAdminClient>;
const MARKERS: { label: string; check: (a: Admin) => Promise<boolean> }[] = [
  { label: "stripe_events.status (Blocker 1)", check: async (a) => !(await a.from("stripe_events").select("status").limit(1)).error },
  { label: "profiles.avatar_url (5.1)", check: async (a) => !(await a.from("profiles").select("avatar_url").limit(1)).error },
  { label: "admin_theme setting (4.3)", check: async (a) => Boolean((await a.from("site_settings").select("key").eq("key", "admin_theme").maybeSingle()).data) },
  { label: "site_url setting (6.5)", check: async (a) => Boolean((await a.from("site_settings").select("key").eq("key", "site_url").maybeSingle()).data) },
];

function rpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || m.includes("could not find the function") || m.includes("does not exist");
}

export type DeepHealth = {
  ok: boolean;
  supabase: { anon: boolean | string; service: boolean | string };
  env: Record<string, boolean>;
  buckets: Record<string, boolean | string>;
  rpcs: Record<string, boolean>;
  migrationMarkers: Record<string, boolean>;
  summary: {
    missingEnv: string[];
    missingBuckets: string[];
    missingRpcs: string[];
    missingMigrationMarkers: string[];
  };
  note: string;
};

/** Full environment/DB/storage check. Callers MUST have verified admin first. */
export async function runDeepHealthCheck(): Promise<DeepHealth> {
  const env: Record<string, boolean> = {};
  for (const k of ENV_VARS) env[k] = Boolean(process.env[k]?.trim());

  const supabase: DeepHealth["supabase"] = { anon: false, service: false };
  try {
    const anon = await createClient();
    const { error } = await anon.from("site_settings").select("key").limit(1);
    supabase.anon = error ? `error: ${error.message}` : true;
  } catch (e) {
    supabase.anon = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  const admin = createAdminClient();
  try {
    const { error } = await admin.from("profiles").select("id").limit(1);
    supabase.service = error ? `error: ${error.message}` : true;
  } catch (e) {
    supabase.service = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  const buckets: Record<string, boolean | string> = {};
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) {
      for (const b of BUCKETS) buckets[b] = `error: ${error.message}`;
    } else {
      const names = new Set((data ?? []).map((x) => x.name));
      for (const b of BUCKETS) buckets[b] = names.has(b);
    }
  } catch (e) {
    for (const b of BUCKETS) buckets[b] = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  const rpcs: Record<string, boolean> = {};
  for (const r of RPCS) {
    try {
      const { error } = await admin.rpc(r.name as never, r.args as never);
      rpcs[r.name] = !rpcMissing(error);
    } catch {
      rpcs[r.name] = true;
    }
  }

  const migrationMarkers: Record<string, boolean> = {};
  for (const m of MARKERS) {
    try {
      migrationMarkers[m.label] = await m.check(admin);
    } catch {
      migrationMarkers[m.label] = false;
    }
  }

  const summary = {
    missingEnv: ENV_VARS.filter((k) => !env[k]),
    missingBuckets: BUCKETS.filter((b) => buckets[b] !== true),
    missingRpcs: RPCS.map((r) => r.name).filter((n) => !rpcs[n]),
    missingMigrationMarkers: Object.entries(migrationMarkers).filter(([, ok]) => !ok).map(([k]) => k),
  };

  const ok =
    supabase.anon === true &&
    supabase.service === true &&
    summary.missingBuckets.length === 0 &&
    summary.missingRpcs.length === 0 &&
    summary.missingMigrationMarkers.length === 0;

  return {
    ok,
    supabase,
    env,
    buckets,
    rpcs,
    migrationMarkers,
    summary,
    note:
      "Migration status is inferred from object existence (this project applies migrations via the SQL editor, so there's no supabase_migrations table to read).",
  };
}
