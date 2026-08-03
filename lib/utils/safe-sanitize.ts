/**
 * Turn a plain-text description into safe HTML (paragraphs + line breaks).
 *
 * WHY THIS EXISTS: isomorphic-dompurify imports jsdom, whose module init can
 * THROW in a serverless production build (FUNCTION_INVOCATION_FAILED) even though
 * it's fine in local dev. Importing it at module scope crashes the whole route's
 * server bundle before anything runs — which took down the listing submit, the
 * owner create/edit and the admin editor. So we load it LAZILY inside a guard.
 *
 * If the sanitizer can't load, we fall back to ESCAPING the user's text (so any
 * markup they typed becomes inert text) rather than emitting unsanitised HTML —
 * safe either way, never a 500.
 */

type Sanitizer = { sanitize: (dirty: string, opts?: unknown) => string };

let resolved = false;
let purify: Sanitizer | null = null;
function getSanitizer(): Sanitizer | null {
  if (resolved) return purify;
  resolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("isomorphic-dompurify");
    purify = (mod?.default ?? mod) as Sanitizer;
  } catch {
    purify = null;
  }
  return purify;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ALLOWED_TAGS = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function buildDescriptionHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sanitizer = getSanitizer();
  if (sanitizer) {
    const html = paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
    return sanitizer.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
  }
  // No sanitizer available — escape the user's text so nothing dangerous ships.
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}
