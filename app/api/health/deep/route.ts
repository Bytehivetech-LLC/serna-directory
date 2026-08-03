import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { runDeepHealthCheck } from "@/lib/admin/health-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only deep health check: env presence, Supabase reachability, buckets,
 *  RPCs, and migration markers. Values are never reported — presence only. */
export async function GET() {
  await requireAdmin();
  const result = await runDeepHealthCheck();
  return NextResponse.json(result);
}
