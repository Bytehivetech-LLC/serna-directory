import "server-only";

export type RecaptchaResult = { ok: boolean; reason?: string };

/**
 * Verify a reCAPTCHA v3 token server-side.
 *
 * If RECAPTCHA_SECRET_KEY isn't configured (e.g. local dev), verification is
 * skipped rather than blocking the flow. On a network error we also don't hard
 * block — a reCAPTCHA outage shouldn't stop legitimate sign-ups.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  action: string,
  minScore = 0.5,
): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
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
    if (typeof data.score === "number" && data.score < minScore) {
      return { ok: false, reason: "Verification failed. Please try again." };
    }
    if (data.action && data.action !== action) {
      return { ok: false, reason: "Verification failed. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
