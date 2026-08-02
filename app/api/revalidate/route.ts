import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_TARGET = process.env.APP_TARGET === "admin" ? "admin" : "web";

/** Constant-time string compare that never leaks length via early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Compare against self so timing doesn't reveal the length mismatch.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Cross-deployment revalidation endpoint. The admin deployment POSTs here after
 * a save so the PUBLIC deployment clears its own Next.js cache. Authenticated by
 * a shared secret; never echoes the secret or the request body.
 */
export async function POST(req: NextRequest) {
  // This bridge only exists to clear the public site's cache.
  if (APP_TARGET !== "web") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation is not configured on this deployment." },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-revalidate-secret") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`revalidate:ip:${clientIp(req)}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const { paths, tags, layout } = body as {
    paths?: unknown;
    tags?: unknown;
    layout?: unknown;
  };
  if (
    (paths !== undefined && !isStringArray(paths)) ||
    (tags !== undefined && !isStringArray(tags)) ||
    (layout !== undefined && typeof layout !== "boolean")
  ) {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  let count = 0;
  if (layout === true) {
    revalidatePath("/", "layout");
    count++;
  }
  for (const p of paths ?? []) {
    if (p.startsWith("/")) {
      revalidatePath(p);
      count++;
    }
  }
  for (const t of tags ?? []) {
    revalidateTag(t);
    count++;
  }

  return NextResponse.json({ revalidated: true, count });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
