import "server-only";

/** Brand colours the shell paints with — sourced from the live site theme so
 * rebranding the site rebrands the emails. */
export type EmailTheme = {
  headerBg: string;
  card: string;
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  indigo: string;
  violet: string;
  violetSoft: string;
  border: string;
};

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
  logoUrl?: string;
  /** Template category → status pill label + colour. */
  category?: string;
  theme: EmailTheme;
};

const PILL: Record<string, { label: string; bg: string; fg: string }> = {
  account: { label: "Account", bg: "#efeafd", fg: "#2e2e8f" },
  listing: { label: "Listing", bg: "#efeafd", fg: "#6c4ce8" },
  billing: { label: "Billing", bg: "#dcf3e8", fg: "#1a8f5c" },
  addon: { label: "Add-on", bg: "#efeafd", fg: "#6c4ce8" },
  inquiry: { label: "Enquiry", bg: "#efeafd", fg: "#2e2e8f" },
  admin: { label: "Admin", bg: "#fbe7e7", fg: "#b02a2a" },
};

/**
 * The transactional email shell — code-owned (admins edit words, never layout).
 * 600px table-based layout with inline styles only (no flexbox/grid), so it
 * survives Outlook. Colours come from the site theme; `color-scheme` + a light
 * palette keep it legible under dark-mode inversion.
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
    logoUrl,
    category,
    theme: t,
  } = input;

  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>`
    : "";

  const brand = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName}" height="28" style="height:28px;width:auto;display:inline-block;border:0" />`
    : `<span style="color:#ffffff;font-weight:700;font-size:18px;font-family:'Bricolage Grotesque',Georgia,serif">${siteName}</span>`;

  const pill = category && PILL[category]
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:${PILL[category].bg};color:${PILL[category].fg};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 10px;border-radius:999px">${PILL[category].label}</td></tr></table>`
    : "";

  const calloutBlock = callout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr>
        <td style="background:${t.violetSoft};border-left:4px solid ${t.violet};border-radius:8px;padding:14px 16px;color:${t.ink};font-size:14px;line-height:1.55;font-family:Inter,Arial,sans-serif">${callout}</td>
      </tr></table>`
    : "";

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr>
          <td style="border-radius:12px;background:${t.indigo}">
            <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;font-family:Inter,Arial,sans-serif;border-radius:12px">${ctaLabel}</a>
          </td>
        </tr></table>`
      : "";

  const footerBlock = footerNote
    ? `<p style="margin:18px 0 0;color:${t.faint};font-size:12px;line-height:1.5;font-family:Inter,Arial,sans-serif">${footerNote}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${siteName}</title>
</head>
<body style="margin:0;padding:0;background:${t.bg};-webkit-font-smoothing:antialiased" bgcolor="${t.bg}">
${preheaderBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px">
      <tr><td style="background:${t.headerBg};border-radius:16px 16px 0 0;padding:20px 28px">${brand}</td></tr>
      <tr><td style="background:${t.card};border:1px solid ${t.border};border-top:none;border-radius:0 0 16px 16px;padding:28px">
        ${pill}
        <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:${t.ink};font-family:'Bricolage Grotesque',Georgia,serif;font-weight:800">${heading}</h1>
        <div style="color:${t.ink};font-size:16px;line-height:1.6;font-family:Inter,Arial,sans-serif">${bodyHtml}</div>
        ${calloutBlock}
        ${ctaBlock}
        ${footerBlock}
      </td></tr>
      <tr><td style="padding:16px 28px;text-align:center">
        <p style="margin:0;color:${t.faint};font-size:12px;line-height:1.5;font-family:Inter,Arial,sans-serif">
          ${siteName} · <a href="mailto:${supportEmail}" style="color:${t.muted};text-decoration:underline">${supportEmail}</a><br />
          Just reply to this email if you need a hand.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
