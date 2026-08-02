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
};

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
