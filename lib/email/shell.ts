import "server-only";

export type EmailShellInput = {
  preheader?: string;
  heading: string;
  /** Already-sanitised HTML for the body paragraphs. */
  bodyHtml: string;
  callout?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  siteName: string;
  supportEmail: string;
};

/**
 * The transactional email shell — code-owned (admins edit words, never layout).
 * Inline styles + tables for broad email-client support; brand tokens hardcoded
 * (email clients can't read CSS variables).
 */
export function renderShell(input: EmailShellInput): string {
  const {
    preheader,
    heading,
    bodyHtml,
    callout,
    ctaLabel,
    ctaUrl,
    footerNote,
    siteName,
    supportEmail,
  } = input;

  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>`
    : "";

  const calloutBlock = callout
    ? `<div style="margin:18px 0;padding:14px 16px;background:#fff8f0;border:1px solid #f4dfc0;border-radius:12px;color:#7a5a1e;font-size:14px;line-height:1.55">${callout}</div>`
    : "";

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:8px;background:#2e2e8f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px">${ctaLabel}</a>`
      : "";

  const footerBlock = footerNote
    ? `<p style="margin:20px 0 0;color:#a4a2bf;font-size:12px;line-height:1.5">${footerNote}</p>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;background:#f7f6fd;font-family:Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  ${preheaderBlock}
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#232268;border-radius:16px 16px 0 0;padding:20px 24px">
      <span style="color:#ffffff;font-weight:700;font-size:16px">${siteName}</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e5f4;border-top:none;border-radius:0 0 16px 16px;padding:26px 24px">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.2;color:#201f3a">${heading}</h1>
      <div style="color:#201f3a;font-size:15px;line-height:1.6">${bodyHtml}</div>
      ${calloutBlock}
      ${ctaBlock}
      ${footerBlock}
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#a4a2bf;font-size:12px">
      ${siteName} · <a href="mailto:${supportEmail}" style="color:#6e6c8a">${supportEmail}</a>
    </p>
  </div>
</body></html>`;
}
