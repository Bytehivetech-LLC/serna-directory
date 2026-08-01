import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * Allowed in exactly three places:
 *   1. the Stripe webhook,
 *   2. account provisioning during listing submission,
 *   3. admin actions that have ALREADY verified the caller is an admin.
 *
 * Never import this into a Client Component, and never expose the key via a
 * NEXT_PUBLIC_ variable. The `server-only` import above turns any client-side
 * import into a build error.
 */

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  // Throw at module load: if this file is ever imported somewhere the key is
  // missing, fail loudly and immediately rather than silently degrading.
  throw new Error(
    "lib/supabase/admin.ts requires NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY. It must only be imported in trusted " +
      "server contexts (Stripe webhook, provisioning, verified-admin actions).",
  );
}

const url: string = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
