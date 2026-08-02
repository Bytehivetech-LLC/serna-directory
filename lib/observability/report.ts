/**
 * Minimal error reporting with PII scrubbing. This is the single funnel every
 * error boundary and catch should call, so wiring a real backend (Sentry) later
 * is a one-file change.
 *
 * To enable Sentry: `npm i @sentry/nextjs`, set SENTRY_DSN, and forward the
 * scrubbed message/context from here to Sentry.captureException. We scrub before
 * anything leaves the process, so PII never reaches the reporter.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const TOKEN = /\b(sk|pk|whsec|SG|rk|AIza)[A-Za-z0-9._-]{6,}\b/g;

export function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").replace(TOKEN, "[redacted]");
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const safe = scrub(message);
  const safeContext = context ? scrub(JSON.stringify(context)) : undefined;
  // Never log the raw stack in production responses; scrub the message here.
  console.error("[error]", safe, safeContext ?? "");
  // TODO(sentry): Sentry.captureException with { extra: safeContext }.
}
