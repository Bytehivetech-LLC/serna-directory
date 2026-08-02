import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

/* ---------------------------------------------------------------- claims -- */

function decodeJwtPayload(token?: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function coerceRole(value: unknown): UserRole | null {
  return value === "admin" || value === "moderator" || value === "user"
    ? value
    : null;
}

/** Read the `user_role` custom claim from a raw access token (JWT). */
export function roleFromAccessToken(token?: string | null): UserRole | null {
  const payload = decodeJwtPayload(token);
  return (
    coerceRole(payload?.["user_role"]) ??
    coerceRole((payload?.["app_metadata"] as Record<string, unknown>)?.["user_role"])
  );
}

/** Read the `user_role` custom claim from a Supabase session. */
function readRoleClaim(session: Session | null): UserRole | null {
  return (
    roleFromAccessToken(session?.access_token) ??
    coerceRole(session?.user?.app_metadata?.["user_role"])
  );
}

/* --------------------------------------------------------------- session -- */

/**
 * The current, VALIDATED session (or null). We call getUser() first — it
 * revalidates the token with the auth server — then return the session that
 * carries the access token (for reading custom claims). Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
});

/** The signed-in user's role from the JWT claim (not a table lookup). */
export const getUserRole = cache(async (): Promise<UserRole | null> => {
  return readRoleClaim(await getSession());
});

/** The signed-in user's profile row, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const session = await getSession();
  if (!session?.user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  return data;
});

/* ---------------------------------------------------------------- guards -- */

/**
 * Require an authenticated user. Redirects to /login?next=… when absent.
 * Pass the current path as `next` so we can return the user afterwards.
 */
export async function requireUser(next?: string): Promise<User> {
  const session = await getSession();
  if (!session?.user) {
    let target = next;
    if (!target) {
      const requestHeaders = await headers();
      target = requestHeaders.get("x-pathname") ?? undefined;
    }
    const suffix = target ? `?next=${encodeURIComponent(target)}` : "";
    redirect(`/login${suffix}`);
  }
  return session.user;
}

/**
 * Require an admin. Reads the role from the JWT claim (never a table query),
 * 403s non-admins, and 403s suspended accounts. Returns the user + profile.
 *
 * Call this in admin layouts AND again inside every admin server action — a
 * layout check alone does not protect an action.
 */
export async function requireAdmin(): Promise<{
  user: User;
  role: UserRole;
  profile: Profile | null;
}> {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/admin");

  const role = readRoleClaim(session);
  if (role !== "admin") forbidden();

  const profile = await getProfile();
  if (profile?.is_suspended) forbidden();

  return { user: session.user, role, profile };
}

/* ------------------------------------------------------------------- MFA -- */

const MFA_METHODS = new Set(["totp", "mfa", "otp", "webauthn", "phone"]);
const RECENT_MFA_WINDOW_SECONDS = 15 * 60;

/**
 * Require that the current admin completed an MFA challenge within the last 15
 * minutes before a high-risk action (writing a secret). Returns:
 *   ok            — a recent MFA challenge is on the session
 *   mfa_required  — the admin has a verified factor but hasn't challenged lately
 *   ok (no factor)— the admin has no MFA factor, so we can't challenge; allowed
 *
 * The client uses `mfa_required` to prompt for a code, elevate the session, and
 * retry. Reusable across every secret-write action.
 */
export async function requireRecentMFA(): Promise<{ ok: boolean; reason: "ok" | "mfa_required" }> {
  const session = await getSession();
  if (!session?.access_token) return { ok: false, reason: "mfa_required" };

  const payload = decodeJwtPayload(session.access_token);
  const amr = Array.isArray(payload?.["amr"]) ? (payload!["amr"] as unknown[]) : [];
  const nowSec = Math.floor(Date.now() / 1000);
  const recent = amr.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as { method?: unknown; timestamp?: unknown };
    return (
      typeof e.method === "string" &&
      MFA_METHODS.has(e.method) &&
      typeof e.timestamp === "number" &&
      nowSec - e.timestamp <= RECENT_MFA_WINDOW_SECONDS
    );
  });
  if (recent) return { ok: true, reason: "ok" };

  // No recent MFA — but only *require* it if a verified factor exists.
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const hasVerified = (data?.totp ?? []).some((f) => f.status === "verified");
    return hasVerified ? { ok: false, reason: "mfa_required" } : { ok: true, reason: "ok" };
  } catch {
    return { ok: true, reason: "ok" };
  }
}

/** Convenience booleans built on the same JWT claim. */
export async function isAdmin(): Promise<boolean> {
  return (await getUserRole()) === "admin";
}

export async function isStaff(): Promise<boolean> {
  const role = await getUserRole();
  return role === "admin" || role === "moderator";
}
