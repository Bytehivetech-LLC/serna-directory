import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_TARGET = process.env.APP_TARGET === "admin" ? "admin" : "web";

/**
 * No-auth, no-data health check. The Settings → General "Test" button and any
 * uptime monitor both hit this. Returns which surface answered.
 */
export function GET() {
  return NextResponse.json({ ok: true, target: APP_TARGET });
}
