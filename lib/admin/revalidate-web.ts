import "server-only";

export type RevalidatePayload = {
  paths?: string[];
  tags?: string[];
  layout?: boolean;
};

/** The public site's base URL, from the env the admin deployment already sets. */
function publicSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Cross-deployment revalidation bridge.
 *
 * The admin app and the public app are two separate Vercel deployments from one
 * repo, each with its own Next.js cache. `revalidatePath()` inside an admin
 * server action only clears the ADMIN cache, so a published theme/branding/
 * taxonomy change never reaches the public site. This POSTs to the public
 * deployment's `/api/revalidate` so it clears its own cache.
 *
 * Contract:
 *  - fire-and-forget with a 3s timeout,
 *  - NEVER throws into the caller — a failed bridge call must not break an
 *    admin save (the admin still sees "Saved"),
 *  - no-ops with a console warning when REVALIDATE_SECRET (or the site URL) is
 *    unset, so local single-deployment dev still works.
 *
 * Returns:
 *  - "synced"  the public cache was cleared,
 *  - "failed"  the bridge is configured but the call didn't succeed,
 *  - "skipped" no bridge is configured (single-deployment / local dev) — the
 *              caller's own revalidatePath already covered the only cache.
 * so the UI can tell the admin honestly whether the public site will refresh.
 */
export type RevalidateWebResult = "synced" | "failed" | "skipped";

export async function revalidateWeb(
  payload: RevalidatePayload,
): Promise<RevalidateWebResult> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const base = publicSiteUrl();

  if (!secret) {
    console.warn(
      "[revalidate-web] REVALIDATE_SECRET is unset — skipping public-site revalidation (fine for local dev).",
    );
    return "skipped";
  }
  if (!base) {
    console.warn(
      "[revalidate-web] NEXT_PUBLIC_SITE_URL is unset — don't know where the public site is; skipping.",
    );
    return "skipped";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[revalidate-web] public site returned ${res.status}.`);
      return "failed";
    }
    return "synced";
  } catch (error) {
    console.warn(
      "[revalidate-web] failed:",
      error instanceof Error ? error.message : error,
    );
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The honest toast line for an admin save that changes public content.
 * `base` is the action's normal success text, shown when no bridge is needed.
 */
export function publicSyncMessage(result: RevalidateWebResult, base: string): string {
  if (result === "synced")
    return "Saved — the public site will update within a few seconds.";
  if (result === "failed")
    return "Saved, but the public site cache didn't clear. It'll refresh on its own shortly.";
  return base;
}
