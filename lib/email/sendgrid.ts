import "server-only";
import sgMail from "@sendgrid/mail";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: { email: string; name?: string };
};

export type SendResult = {
  status: "sent" | "skipped" | "failed";
  providerId?: string;
  error?: string;
};

/**
 * Low-level SendGrid send. Never throws. Returns a structured result (used for
 * email_log). "skipped" = SendGrid not configured (dev); "failed" = an error.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn(
      `[email] SendGrid not configured — would send "${input.subject}" to ${input.to}`,
    );
    return { status: "skipped" };
  }

  try {
    sgMail.setApiKey(apiKey);
    const [response] = await sgMail.send({
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
    const providerId =
      (response?.headers?.["x-message-id"] as string | undefined) ?? undefined;
    return { status: "sent", providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] SendGrid send failed:", message);
    return { status: "failed", error: message };
  }
}
