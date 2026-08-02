import "server-only";
import { getRecaptchaSecret, markIntegrationSuccess } from "@/lib/secrets/resolve";

export type RecaptchaResult = {
  ok: boolean;
  reason?: string;
  score?: number;
  /** True in the hold band — the caller should route to manual review, not reject. */
  review?: boolean;
};

/**
 * Verify a reCAPTCHA v3 token server-side.
 *
 * Score bands: `>= minScore` passes; `[reviewScore, minScore)` passes but sets
 * `review` so the caller can hold it for a human instead of rejecting a possibly-
 * legitimate visitor; `< reviewScore` is rejected. If reCAPTCHA isn't configured
 * or the API is unreachable, we don't hard-block — an outage shouldn't stop
 * legitimate sign-ups.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  action: string,
  minScore = 0.5,
  reviewScore = 0.3,
): Promise<RecaptchaResult> {
  const secret = await getRecaptchaSecret();
  if (!secret) return { ok: true };
  if (!token) return { ok: false, reason: "Verification failed. Please try again." };

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
    };

    if (!data.success) {
      return { ok: false, reason: "Verification failed. Please try again." };
    }
    if (data.action && data.action !== action) {
      return { ok: false, reason: "Verification failed. Please try again." };
    }
    const score = data.score;
    if (typeof score === "number") {
      if (score < reviewScore) return { ok: false, reason: "Verification failed. Please try again.", score };
      if (score < minScore) return { ok: true, review: true, score };
      return { ok: true, score };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
