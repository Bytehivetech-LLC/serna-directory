import "server-only";
import sgMail from "@sendgrid/mail";
import { getSendgridKey, getSendgridFrom, markIntegrationSuccess } from "@/lib/secrets/resolve";

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
  // Keys resolve from the integrations panel first, env second.
  const [apiKey, from] = await Promise.all([getSendgridKey(), getSendgridFrom()]);
  if (!apiKey || !from.email) {
    console.warn(
      `[email] SendGrid not configured — would send "${input.subject}" to ${input.to}`,
    );
    return { status: "skipped" };
  }

  try {
    sgMail.setApiKey(apiKey);
    const [response] = await sgMail.send({
      to: input.to,
      from: { email: from.email, name: from.name },
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const providerId =
      (response?.headers?.["x-message-id"] as string | undefined) ?? undefined;
    void markIntegrationSuccess("sendgrid");
    return { status: "sent", providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] SendGrid send failed:", message);
    return { status: "failed", error: message };
  }
}
