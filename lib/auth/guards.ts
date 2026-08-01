import "server-only";
import { cache } from "react";
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

/** Read the `user_role` custom claim from a Supabase access token (JWT). */
function readRoleClaim(session: Session | null): UserRole | null {
  const payload = decodeJwtPayload(session?.access_token);
  return (
    coerceRole(payload?.["user_role"]) ??
    coerceRole((payload?.["app_metadata"] as Record<string, unknown>)?.["user_role"]) ??
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
    const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
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

/** Convenience booleans built on the same JWT claim. */
export async function isAdmin(): Promise<boolean> {
  return (await getUserRole()) === "admin";
}

export async function isStaff(): Promise<boolean> {
  const role = await getUserRole();
  return role === "admin" || role === "moderator";
}
