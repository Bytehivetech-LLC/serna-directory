import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSweep } from "@/lib/assets/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly sweep (GET /api/cron/weekly, Authorization: Bearer $CRON_SECRET):
 * list storage and enqueue any object with no live DB reference that's older
 * than 24h — the safety net for abandoned drafts and half-finished uploads.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const sweep = await runSweep(admin);
  return NextResponse.json({ ok: true, ...sweep });
}
