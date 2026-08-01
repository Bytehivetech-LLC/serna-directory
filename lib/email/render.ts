import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { renderShell } from "./shell";
import {
  FALLBACK_TEMPLATES,
  GENERIC_FALLBACK,
  type TemplateShape,
} from "./fallbacks";

export type EmailContext = Record<string, string | number | null | undefined>;
export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Interpolate {{vars}}. Template text is trusted (admin-authored); context
 * values are not, so they're HTML-escaped by default. Pass escape:false only
 * for plain-text (subject, text body) or URL contexts.
 */
function interpolate(template: string, ctx: EmailContext, escape = true): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = ctx[key];
    const str = value === null || value === undefined ? "" : String(value);
    return escape ? escapeHtml(str) : str;
  });
}

function bodyToHtml(body: string, ctx: EmailContext): string {
  // Context values are escaped during interpolation; split the trusted template
  // text into paragraphs.
  return interpolate(body, ctx)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function resolveCtaUrl(path: string, siteUrl: string): string {
  if (/^(https?:|mailto:)/i.test(path)) return path;
  if (path.startsWith("/")) return `${siteUrl}${path}`;
  return path;
}

async function loadTemplate(key: string): Promise<TemplateShape | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select(
        "subject, preheader, heading, body, callout, cta_label, cta_path, footer_note",
      )
      .eq("key", key)
      .eq("is_enabled", true)
      .maybeSingle();
    if (!data) return null;
    return {
      subject: data.subject,
      preheader: data.preheader ?? undefined,
      heading: data.heading,
      body: data.body,
      callout: data.callout ?? undefined,
      cta_label: data.cta_label ?? undefined,
      cta_path: data.cta_path ?? undefined,
      footer_note: data.footer_note ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Render a transactional email by template key. Reads the (admin-editable)
 * email_templates row, interpolates {{variables}} from `context` plus global
 * site context, and wraps it in the code-owned shell. Falls back to a hardcoded
 * template so a critical email still sends. Phase 16 builds the full editor on
 * top of this same render(key, context) contract.
 */
export async function renderTemplate(
  key: string,
  context: EmailContext,
): Promise<RenderedEmail> {
  const template =
    (await loadTemplate(key)) ?? FALLBACK_TEMPLATES[key] ?? GENERIC_FALLBACK;

  const settings = await getSettings(["site_name", "support_email"]);
  const ctx: EmailContext = {
    site_name:
      (settings.site_name as string) ?? "Serna Educational Services",
    support_email:
      (settings.support_email as string) ?? "Info@SernaEducationalServices.com",
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ...context,
  };

  const siteUrl = String(ctx.site_url);

  // Plain text (not HTML): subject, and the text body.
  const subject = interpolate(template.subject, ctx, false);

  // HTML fields (context values escaped inside interpolate).
  const heading = interpolate(template.heading, ctx);
  const bodyHtml = bodyToHtml(template.body, ctx);
  const callout = template.callout ? interpolate(template.callout, ctx) : undefined;
  const ctaLabel = template.cta_label
    ? interpolate(template.cta_label, ctx)
    : undefined;
  const footerNote = template.footer_note
    ? interpolate(template.footer_note, ctx)
    : undefined;
  const preheader = template.preheader
    ? interpolate(template.preheader, ctx)
    : undefined;

  // CTA URL: interpolate raw (it's a URL), resolve, then escape for the href
  // attribute so a value can't break out of href="…".
  const rawCtaUrl = template.cta_path
    ? resolveCtaUrl(interpolate(template.cta_path, ctx, false), siteUrl)
    : undefined;
  const ctaUrl = rawCtaUrl ? escapeHtml(rawCtaUrl) : undefined;

  const html = renderShell({
    preheader,
    heading,
    bodyHtml,
    callout,
    ctaLabel,
    ctaUrl,
    footerNote,
    siteName: String(ctx.site_name),
    supportEmail: String(ctx.support_email),
  });

  const text = [
    interpolate(template.heading, ctx, false),
    "",
    interpolate(template.body, ctx, false),
    rawCtaUrl
      ? `\n${interpolate(template.cta_label ?? "Open", ctx, false)}: ${rawCtaUrl}`
      : "",
    template.callout ? `\n${interpolate(template.callout, ctx, false)}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
