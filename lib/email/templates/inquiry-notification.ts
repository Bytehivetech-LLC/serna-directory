import "server-only";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InquiryEmailInput = {
  businessName: string;
  listingUrl: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
};

/**
 * Owner notification for a new inquiry. The HTML shell is code (brand theme);
 * reply-to is set to the enquirer by the caller, so the owner replies straight
 * to them. The owner's address is never shown to the enquirer.
 */
export function buildInquiryEmail(input: InquiryEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { businessName, listingUrl, name, email, phone, message } = input;
  const subject = `New inquiry about ${businessName}`;

  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:6px 0;color:#6e6c8a;font-size:13px;width:88px;vertical-align:top">${label}</td>
      <td style="padding:6px 0;color:#201f3a;font-size:14px;font-weight:600">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f6fd;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#232268;border-radius:16px 16px 0 0;padding:20px 24px">
      <span style="color:#fff;font-weight:700;font-size:16px">Serna Educational Services</span>
    </div>
    <div style="background:#fff;border:1px solid #e7e5f4;border-top:none;border-radius:0 0 16px 16px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px;color:#201f3a">New inquiry</h1>
      <p style="margin:0 0 18px;color:#6e6c8a;font-size:14px">
        Someone contacted you about <b style="color:#201f3a">${escapeHtml(businessName)}</b>.
      </p>
      <table style="width:100%;border-collapse:collapse">
        ${row("From", escapeHtml(name))}
        ${row("Email", escapeHtml(email))}
        ${phone ? row("Phone", escapeHtml(phone)) : ""}
      </table>
      <div style="margin-top:16px;padding:16px;background:#f7f6fd;border:1px solid #e7e5f4;border-radius:12px;color:#201f3a;font-size:14px;line-height:1.55">
        ${safeMessage}
      </div>
      <a href="${escapeHtml(listingUrl)}" style="display:inline-block;margin-top:20px;background:#2e2e8f;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:12px">
        View your listing
      </a>
      <p style="margin:18px 0 0;color:#a4a2bf;font-size:12px">
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  </div>
</body></html>`;

  const text = [
    `New inquiry about ${businessName}`,
    ``,
    `From: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : ``,
    ``,
    message,
    ``,
    `View your listing: ${listingUrl}`,
    `Reply directly to this email to respond to ${name}.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { subject, html, text };
}
