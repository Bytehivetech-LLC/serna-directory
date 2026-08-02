import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAddonMaintenance, runPurge, runDrain } from "@/lib/assets/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily maintenance (schedule a Vercel Cron at GET /api/cron/daily,
 * Authorization: Bearer $CRON_SECRET):
 *   1. Add-on expiry + 7-day renewal reminders.
 *   2. PURGE — hard-delete listings past their deletion grace period (cascade +
 *      trigger enqueue the storage paths).
 *   3. DRAIN — remove up to 100 queued objects via the Storage API, with
 *      attempts/last_error and a 3-strike fail state.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const addons = await runAddonMaintenance(admin);
  const purge = await runPurge(admin);
  const drain = await runDrain(admin);

  return NextResponse.json({ ok: true, ...addons, ...purge, ...drain });
}
