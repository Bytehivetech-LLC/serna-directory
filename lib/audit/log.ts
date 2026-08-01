import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, getProfile } from "@/lib/auth/guards";
import type { Json } from "@/types";

type AuditActor = { id: string | null; email: string | null };

export type AuditInput = {
  /** Verb.noun, e.g. "user.suspend", "listing.approve". */
  action: string;
  entityType?: string;
  entityId?: string | null;
  /** State before the change (only the relevant fields). */
  before?: Record<string, unknown> | null;
  /** State after the change (only the relevant fields). */
  after?: Record<string, unknown> | null;
  /** Extra context (e.g. a suspension reason, a bulk count). */
  meta?: Record<string, unknown>;
  /** Override the actor (defaults to the current signed-in admin). */
  actor?: AuditActor;
};

/** Keys whose before/after values differ — the actual diff. */
function computeDiff(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before && !after) return null;
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changed[key] = { from: from ?? null, to: to ?? null };
    }
  }
  return Object.keys(changed).length ? changed : null;
}

function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/**
 * Write one immutable audit_log row. Call this from EVERY admin mutation, AFTER
 * the change succeeds, with the actor implied by the current session. Uses the
 * service-role client (audit_log is not owner-writable) — only reached from
 * actions that have already passed requireAdmin(). Never throws into the caller:
 * a logging failure must not roll back a completed action, but it is surfaced in
 * the server logs so a silent gap is noticeable.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    let actor = input.actor;
    if (!actor) {
      const [session, profile] = await Promise.all([getSession(), getProfile()]);
      actor = {
        id: session?.user?.id ?? null,
        email: profile?.email ?? session?.user?.email ?? null,
      };
    }

    const h = await headers();
    const diff = computeDiff(input.before, input.after);
    const payload =
      diff || input.meta
        ? { ...(diff ? { changed: diff } : {}), ...(input.meta ?? {}) }
        : null;

    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      diff: (payload as Json) ?? null,
      ip_address: clientIp(h),
      user_agent: h.get("user-agent"),
    });
    if (error) {
      console.error("logAudit insert failed", input.action, error.message);
    }
  } catch (err) {
    console.error("logAudit threw", input.action, err);
  }
}
