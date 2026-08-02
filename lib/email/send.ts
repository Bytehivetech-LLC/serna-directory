import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./sendgrid";
import { renderTemplate, type EmailContext } from "./render";

export type SendTemplateOptions = {
  to: string;
  context?: EmailContext;
  listingId?: string | null;
  userId?: string | null;
  replyTo?: { email: string; name?: string };
  /** Force a send even when the template row is disabled (used by "send test"). */
  force?: boolean;
};

/**
 * Non-essential templates an owner may opt out of. Everything else — receipts,
 * enquiries, and account-security mail — always sends.
 */
const OPTIONAL_KEYS = new Set([
  "listing_expiring",
  "listing_expired",
  "addon_expiring",
  "welcome",
  "tips",
]);

async function hasOptedOut(userId: string, key: string): Promise<boolean> {
  if (!OPTIONAL_KEYS.has(key)) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("email_opt_out").eq("id", userId).maybeSingle();
    const list = Array.isArray(data?.email_opt_out) ? (data!.email_opt_out as unknown[]) : [];
    return list.includes(key) || list.includes("all_optional");
  } catch {
    return false;
  }
}

/**
 * Render a template by key and send it, then record the outcome in email_log
 * (template, recipient, subject, status, provider id, error) — never the body.
 * Wrapped so a mail failure never breaks the caller's flow; returns whether the
 * email was actually sent.
 */
export async function sendTemplateEmail(
  templateKey: string,
  options: SendTemplateOptions,
): Promise<boolean> {
  let subject = "";
  let status: "sent" | "skipped" | "failed" = "failed";
  let providerId: string | undefined;
  let error: string | undefined;

  try {
    const rendered = await renderTemplate(templateKey, options.context ?? {});
    subject = rendered.subject;

    // Skip semantics: optional templates that are missing or disabled don't send;
    // locked templates always send. "force" (send-test) overrides.
    const disabled = rendered.found && !rendered.enabled && !rendered.locked;
    const optionalMissing = rendered.generic;
    let skip = !options.force && (disabled || optionalMissing);

    // Owner opt-out for non-essential mail.
    if (!skip && !options.force && options.userId) {
      skip = await hasOptedOut(options.userId, templateKey);
    }

    if (skip) {
      status = "skipped";
      error = optionalMissing ? "no template" : disabled ? "disabled" : "opted out";
    } else {
      const result = await sendEmail({
        to: options.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: options.replyTo,
      });
      status = result.status;
      providerId = result.providerId;
      error = result.error;
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.error(`[email] render/send "${templateKey}" failed:`, error);
  }

  // Log the outcome — best-effort, never throws, never logs the body.
  try {
    const admin = createAdminClient();
    await admin.from("email_log").insert({
      template_key: templateKey,
      to_email: options.to,
      subject,
      listing_id: options.listingId ?? null,
      user_id: options.userId ?? null,
      status,
      provider_id: providerId ?? null,
      error_message: error ?? null,
    });
  } catch (logError) {
    console.error(
      "[email] email_log insert failed:",
      logError instanceof Error ? logError.message : logError,
    );
  }

  return status === "sent";
}
