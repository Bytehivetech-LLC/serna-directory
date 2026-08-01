import "server-only";
import sgMail from "@sendgrid/mail";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: { email: string; name?: string };
};

/**
 * Send a transactional email via SendGrid. If SENDGRID_API_KEY isn't configured
 * (e.g. local dev), it logs and no-ops rather than throwing — callers treat
 * email as best-effort so a mail hiccup never loses the underlying record.
 * Returns whether the send was attempted successfully.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn(
      `[email] SendGrid not configured — would send "${input.subject}" to ${input.to}`,
    );
    return false;
  }

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: input.to,
      from: {
        email: fromEmail,
        name: process.env.SENDGRID_FROM_NAME || "Serna Educational Services",
      },
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return true;
  } catch (error) {
    console.error(
      "[email] SendGrid send failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
