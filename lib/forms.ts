import type { ZodError } from "zod";

/**
 * Standard return shape for form Server Actions used with useActionState.
 * `error` is a top-level problem (auth failure, rate limit); `fieldErrors`
 * are per-input; `message` is a success/info line.
 */
export type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

export const initialFormState: FormState = { ok: false };

/** First error message per field, keyed by the top-level field name. */
export function zodErrorToFieldErrors(
  error: ZodError,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Only allow same-site, absolute-path redirects (blocks open-redirect via
 * ?next=//evil.com or ?next=https://evil.com).
 */
export function safeNext(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
