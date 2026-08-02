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
 * Fixed-window rate limit backed by the `rate_limits` table via the atomic
 * `public.hit_rate_limit(...)` SECURITY DEFINER RPC (see
 * supabase/migrations/20260801120000_hit_rate_limit.sql).
 *
 * `bucket` should already include the identifier, e.g. `login:ip:${ip}` or
 * `login:email:${email}`. Call from Server Actions / Route Handlers before
 * doing the work.
 *
 * Why the RPC: RLS (correctly) blocks anon writes to rate_limits, but login
 * limiting must run unauthenticated. The RPC runs as the definer for this one
 * controlled increment, so the app never needs the service-role key here, and
 * the increment is atomic (no read-modify-write race).
 *
 * Fails OPEN: if the RPC isn't present yet or the DB can't be reached, a
 * legitimate request is never blocked; the event is logged instead.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const fallbackReset = new Date(Date.now() + windowSeconds * 1000);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("hit_rate_limit returned no row");

    return {
      allowed: Boolean(row.allowed),
      remaining: row.remaining ?? 0,
      limit,
      resetAt: row.reset_at ? new Date(row.reset_at) : fallbackReset,
    };
  } catch (error) {
    console.warn(
      `[rate-limit] "${bucket}" failed open:`,
      error instanceof Error ? error.message : error,
    );
    return { allowed: true, remaining: limit, limit, resetAt: fallbackReset };
  }
}

/** Minutes (rounded up) until a rate-limit window resets — for user messages. */
export function minutesUntil(resetAt: Date): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 60000));
}
