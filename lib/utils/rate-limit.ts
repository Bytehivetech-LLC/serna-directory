import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RateLimitResult = {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  limit: number;
  /** When the current window resets. */
  resetAt: Date;
};

/**
 * Fixed-window rate limit backed by the `rate_limits` table
 * (PK: bucket + window_start, counter: hits).
 *
 * `bucket` should already include the identifier, e.g. `inquiry:${ip}` or
 * `listing-create:${userId}`. Call from Server Actions / Route Handlers before
 * doing the work.
 *
 * Notes:
 *  - Uses the RLS-bound request client (never the service-role key).
 *  - Read-modify-write, so it can undercount under heavy concurrency; a
 *    SECURITY DEFINER `increment_rate_limit(...)` RPC should back this in
 *    production for atomicity. Adequate for current form-submission volumes.
 *  - Fails OPEN: if the table can't be reached (or RLS blocks the write) a
 *    legitimate request is never blocked; the event is logged instead.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const resetAt = new Date(windowStartMs + windowMs);

  try {
    const supabase = await createClient();

    const { data: existing, error: readError } = await supabase
      .from("rate_limits")
      .select("hits")
      .eq("bucket", bucket)
      .eq("window_start", windowStart)
      .maybeSingle();
    if (readError) throw readError;

    const current = existing?.hits ?? 0;
    if (current >= limit) {
      return { allowed: false, remaining: 0, limit, resetAt };
    }

    const next = current + 1;
    const { error: writeError } = await supabase
      .from("rate_limits")
      .upsert(
        { bucket, window_start: windowStart, hits: next },
        { onConflict: "bucket,window_start" },
      );
    if (writeError) throw writeError;

    return { allowed: true, remaining: Math.max(0, limit - next), limit, resetAt };
  } catch (error) {
    console.warn(
      `[rate-limit] "${bucket}" failed open:`,
      error instanceof Error ? error.message : error,
    );
    return { allowed: true, remaining: limit, limit, resetAt };
  }
}
