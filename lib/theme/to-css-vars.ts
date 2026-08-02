import {
  THEME_COLOR_KEYS,
  THEME_CSS_VAR,
  defaultTheme,
  type Theme,
} from "./defaults";
import {
  ADMIN_EXTRA_KEYS,
  ADMIN_EXTRA_CSS_VAR,
  defaultAdminTheme,
  type AdminTheme,
} from "./admin-defaults";

/**
 * Parse a hex colour (#rgb / #rrggbb, with or without the leading #) into
 * space-separated RGB channels: "#2e2e8f" -> "46 46 143".
 * Returns null for anything it can't parse, so callers can fall back.
 */
export function hexToRgbChannels(hex: string): string | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** CSS-escape a font family name for embedding in a quoted string. */
function safeFamily(name: string): string {
  return String(name).replace(/["\\<>]/g, "").trim() || "sans-serif";
}

/**
 * Build the `:root { ... }` block that drives the whole theme. Colours become
 * RGB channels (so Tailwind opacity modifiers keep working), radius and font
 * families pass through. Any individual bad colour silently falls back to the
 * default for that slot — a single malformed value can never blank the site.
 */
/**
 * Same as toCssVars but scoped to an arbitrary selector (e.g. a live-preview
 * container). Values are still parsed/validated per-slot; the only interpolation
 * is into the custom-property block, never arbitrary CSS.
 */
export function toCssVarsScoped(theme: Theme, selector: string): string {
  return toCssVars(theme).replace(/^:root/, selector);
}

export function toCssVars(theme: Theme): string {
  const lines: string[] = [];

  for (const key of THEME_COLOR_KEYS) {
    const channels =
      hexToRgbChannels(theme[key]) ?? hexToRgbChannels(defaultTheme[key])!;
    lines.push(`  ${THEME_CSS_VAR[key]}: ${channels};`);
  }

  const radius =
    typeof theme.radius === "string" && theme.radius.trim()
      ? theme.radius.trim()
      : defaultTheme.radius;
  lines.push(`  --radius-card: ${radius};`);

  const display = safeFamily(theme.fontDisplay || defaultTheme.fontDisplay);
  const body = safeFamily(theme.fontBody || defaultTheme.fontBody);
  lines.push(
    `  --font-display: "${display}", var(--font-bricolage), ui-sans-serif, system-ui, sans-serif;`,
  );
  lines.push(
    `  --font-body: "${body}", var(--font-inter), ui-sans-serif, system-ui, sans-serif;`,
  );

  return `:root {\n${lines.join("\n")}\n}`;
}

/**
 * The admin theme: the full public-theme var block PLUS the sidebar/brand-bar
 * vars, scoped to `selector` (the admin shell wrapper) so it overrides the
 * published public theme within the admin subtree only. Each colour is
 * validated per-slot and falls back to the admin default; the public site's
 * :root is never touched.
 */
export function toAdminCssVars(theme: AdminTheme, selector: string): string {
  const lines: string[] = [];

  for (const key of THEME_COLOR_KEYS) {
    const channels =
      hexToRgbChannels(theme[key]) ?? hexToRgbChannels(defaultAdminTheme[key])!;
    lines.push(`  ${THEME_CSS_VAR[key]}: ${channels};`);
  }
  for (const key of ADMIN_EXTRA_KEYS) {
    const channels =
      hexToRgbChannels(theme[key]) ?? hexToRgbChannels(defaultAdminTheme[key])!;
    lines.push(`  ${ADMIN_EXTRA_CSS_VAR[key]}: ${channels};`);
  }

  const radius =
    typeof theme.radius === "string" && theme.radius.trim()
      ? theme.radius.trim()
      : defaultAdminTheme.radius;
  lines.push(`  --radius-card: ${radius};`);

  return `${selector} {\n${lines.join("\n")}\n}`;
}
