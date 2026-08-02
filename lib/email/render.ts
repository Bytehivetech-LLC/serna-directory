import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getTheme } from "@/lib/theme/get-theme";
import { renderShell, type EmailTheme } from "./shell";
import {
  FALLBACK_TEMPLATES,
  GENERIC_FALLBACK,
  type TemplateShape,
} from "./fallbacks";

export type EmailContext = Record<string, string | number | null | undefined>;
export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  /** True when a real (DB or code-fallback) template backed the render. */
  found: boolean;
  enabled: boolean;
  locked: boolean;
  /** True when only the generic fallback backed it (optional templates skip). */
  generic: boolean;
};

type LoadedTemplate = TemplateShape & {
  category?: string;
  enabled: boolean;
  locked: boolean;
  found: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Interpolate {{vars}}. Template literal text is escaped by the caller when it
 * lands in HTML; here we only substitute context values. A MISSING variable is
 * left as the raw `{{key}}` and a warning is logged — an email that goes out
 * slightly wrong beats one that never goes out.
 */
function interpolate(template: string, ctx: EmailContext, escape: boolean, key: string): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    if (!(name in ctx) || ctx[name] === undefined) {
      console.warn(`[email] template "${key}" missing variable {{${name}}}`);
      return `{{${name}}}`;
    }
    const value = ctx[name];
    const str = value === null ? "" : String(value);
    return escape ? escapeHtml(str) : str;
  });
}

/** Markdown-lite: **bold**, [text](url) (safe schemes only), paragraphs. Input
 * is already fully HTML-escaped, so we only ever emit our own tags. */
function markdownLite(escaped: string): string {
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (_m, label: string, url: string) => `<a href="${url}" style="color:inherit;text-decoration:underline">${label}</a>`,
  );
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return withBold
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Escape the trusted template text, then substitute (escaped) context values. */
function toEscapedInterpolated(template: string, ctx: EmailContext, key: string): string {
  return interpolate(escapeHtml(template), ctx, true, key);
}

function resolveCtaUrl(path: string, siteUrl: string): string {
  if (/^(https?:|mailto:)/i.test(path)) return path;
  if (path.startsWith("/")) return `${siteUrl}${path}`;
  return path;
}

async function loadTemplate(key: string): Promise<LoadedTemplate> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select("subject, preheader, heading, body, callout, cta_label, cta_path, footer_note, category, is_enabled, is_locked")
      .eq("key", key)
      .maybeSingle();
    if (data) {
      return {
        subject: data.subject,
        preheader: data.preheader ?? undefined,
        heading: data.heading,
        body: data.body,
        callout: data.callout ?? undefined,
        cta_label: data.cta_label ?? undefined,
        cta_path: data.cta_path ?? undefined,
        footer_note: data.footer_note ?? undefined,
        category: data.category,
        enabled: data.is_enabled,
        locked: data.is_locked,
        found: true,
      };
    }
  } catch {
    /* fall through to code fallback */
  }

  const fallback = FALLBACK_TEMPLATES[key];
  if (fallback) {
    return { ...fallback, enabled: true, locked: true, found: true };
  }
  return { ...GENERIC_FALLBACK, enabled: true, locked: false, found: false };
}

export type RenderShapeInput = TemplateShape & { category?: string };

/**
 * Render arbitrary template fields (from the DB, a fallback, or the live editor)
 * into subject/html/text. Exposed so /admin/emails can preview unsaved edits.
 */
export async function renderShape(
  template: RenderShapeInput,
  context: EmailContext,
  key = "preview",
): Promise<{ subject: string; html: string; text: string }> {
  const [settings, theme] = await Promise.all([
    getSettings(["site_name", "support_email", "logo_url"]),
    getTheme(),
  ]);
  const ctx: EmailContext = {
    site_name: (settings.site_name as string) ?? "Serna Educational Services",
    support_email: (settings.support_email as string) ?? "Info@SernaEducationalServices.com",
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ...context,
  };
  const siteUrl = String(ctx.site_url);

  const subject = interpolate(template.subject, ctx, false, key);
  const heading = toEscapedInterpolated(template.heading, ctx, key);
  const bodyHtml = markdownLite(toEscapedInterpolated(template.body, ctx, key));
  const callout = template.callout ? markdownLite(toEscapedInterpolated(template.callout, ctx, key)) : undefined;
  const ctaLabel = template.cta_label ? toEscapedInterpolated(template.cta_label, ctx, key) : undefined;
  const footerNote = template.footer_note ? toEscapedInterpolated(template.footer_note, ctx, key) : undefined;
  const preheader = template.preheader ? toEscapedInterpolated(template.preheader, ctx, key) : undefined;

  const rawCtaUrl = template.cta_path
    ? resolveCtaUrl(interpolate(template.cta_path, ctx, false, key), siteUrl)
    : undefined;
  const ctaUrl = rawCtaUrl ? escapeHtml(rawCtaUrl) : undefined;

  const emailTheme: EmailTheme = {
    headerBg: theme.headerBg,
    card: theme.card,
    bg: theme.bg,
    ink: theme.ink,
    muted: theme.muted,
    faint: theme.faint,
    indigo: theme.indigo,
    violet: theme.violet,
    violetSoft: theme.violetSoft,
    border: theme.border,
  };

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
    logoUrl: typeof settings.logo_url === "string" && settings.logo_url ? settings.logo_url : undefined,
    category: template.category,
    theme: emailTheme,
  });

  const text = [
    interpolate(template.heading, ctx, false, key),
    "",
    interpolate(template.body, ctx, false, key),
    rawCtaUrl ? `\n${interpolate(template.cta_label ?? "Open", ctx, false, key)}: ${rawCtaUrl}` : "",
    template.callout ? `\n${interpolate(template.callout, ctx, false, key)}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}

/**
 * Render a transactional email by template key. Reads the admin-editable row (or
 * a code fallback) and returns metadata the send path uses to decide whether to
 * actually send (enabled / locked / generic).
 */
export async function renderTemplate(
  key: string,
  context: EmailContext,
): Promise<RenderedEmail> {
  const template = await loadTemplate(key);
  const { subject, html, text } = await renderShape(template, context, key);
  return {
    subject,
    html,
    text,
    found: template.found,
    enabled: template.enabled,
    locked: template.locked,
    generic: !template.found,
  };
}
