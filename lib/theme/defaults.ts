/**
 * The fallback theme. Every colour is a hex string; `to-css-vars.ts` converts
 * them to space-separated RGB channels for Tailwind's alpha modifiers.
 *
 * The admin can override any of these via the `theme` row in site_settings,
 * but this object is what the site renders with when that row is missing,
 * malformed, or a single value is invalid.
 */
export type Theme = {
  // text
  ink: string;
  muted: string;
  faint: string;
  // brand
  indigo: string;
  indigoDeep: string;
  violet: string;
  violetSoft: string;
  // surfaces
  bg: string;
  card: string;
  border: string;
  borderStrong: string;
  // status
  good: string;
  goodSoft: string;
  warm: string;
  warmBorder: string;
  warnInk: string;
  warnStrong: string;
  warnIcon: string;
  danger: string;
  dangerSoft: string;
  track: string;
  // header
  headerBg: string;
  headerText: string;
  headerBorder: string;
  headerSearchBg: string;
  headerSearchText: string;
  headerSearchBorder: string;
  headerSearchIcon: string;
  headerButtonBg: string;
  headerButtonText: string;
  headerButtonHoverBg: string;
  headerLinkText: string;
  headerLinkHoverText: string;
  // shape + type
  radius: string;
  fontDisplay: string;
  fontBody: string;
};

export const defaultTheme: Theme = {
  ink: "#201f3a",
  muted: "#6e6c8a",
  faint: "#a4a2bf",

  indigo: "#2e2e8f",
  indigoDeep: "#232268",
  violet: "#6c4ce8",
  violetSoft: "#efeafd",

  bg: "#f7f6fd",
  card: "#ffffff",
  border: "#e7e5f4",
  borderStrong: "#d5d2ec",

  good: "#1a8f5c",
  goodSoft: "#dcf3e8",
  warm: "#fff8f0",
  warmBorder: "#f4dfc0",
  warnInk: "#7a5a1e", // body text on warm
  warnStrong: "#5c430f", // bold text on warm
  warnIcon: "#b4791e", // icon on warm
  danger: "#d64545",
  dangerSoft: "#fbe7e7",
  track: "#edecf7", // progress-bar track

  headerBg: "#232268",
  headerText: "#ffffff",
  headerBorder: "#34327e",
  headerSearchBg: "#35357e",
  headerSearchText: "#ffffff",
  headerSearchBorder: "#4a4a94",
  headerSearchIcon: "#b4b4d8",
  headerButtonBg: "#6c4ce8",
  headerButtonText: "#ffffff",
  headerButtonHoverBg: "#5a3fd0",
  headerLinkText: "#cbcbe4",
  headerLinkHoverText: "#ffffff",

  radius: "16px",
  fontDisplay: "Bricolage Grotesque",
  fontBody: "Inter",
};

/** The colour keys — everything in Theme except radius/font fields. */
export const THEME_COLOR_KEYS = [
  "ink",
  "muted",
  "faint",
  "indigo",
  "indigoDeep",
  "violet",
  "violetSoft",
  "bg",
  "card",
  "border",
  "borderStrong",
  "good",
  "goodSoft",
  "warm",
  "warmBorder",
  "warnInk",
  "warnStrong",
  "warnIcon",
  "danger",
  "dangerSoft",
  "track",
  "headerBg",
  "headerText",
  "headerBorder",
  "headerSearchBg",
  "headerSearchText",
  "headerSearchBorder",
  "headerSearchIcon",
  "headerButtonBg",
  "headerButtonText",
  "headerButtonHoverBg",
  "headerLinkText",
  "headerLinkHoverText",
] as const satisfies ReadonlyArray<keyof Theme>;

/** Maps each Theme key to the CSS custom property it drives. */
export const THEME_CSS_VAR: Record<
  (typeof THEME_COLOR_KEYS)[number],
  string
> = {
  ink: "--c-ink",
  muted: "--c-muted",
  faint: "--c-faint",
  indigo: "--c-indigo",
  indigoDeep: "--c-indigo-deep",
  violet: "--c-violet",
  violetSoft: "--c-violet-soft",
  bg: "--c-bg",
  card: "--c-card",
  border: "--c-border",
  borderStrong: "--c-border-strong",
  good: "--c-good",
  goodSoft: "--c-good-soft",
  warm: "--c-warm",
  warmBorder: "--c-warm-border",
  warnInk: "--c-warn-ink",
  warnStrong: "--c-warn-strong",
  warnIcon: "--c-warn-icon",
  danger: "--c-danger",
  dangerSoft: "--c-danger-soft",
  track: "--c-track",
  headerBg: "--c-header-bg",
  headerText: "--c-header-text",
  headerBorder: "--c-header-border",
  headerSearchBg: "--c-header-search-bg",
  headerSearchText: "--c-header-search-text",
  headerSearchBorder: "--c-header-search-border",
  headerSearchIcon: "--c-header-search-icon",
  headerButtonBg: "--c-header-button-bg",
  headerButtonText: "--c-header-button-text",
  headerButtonHoverBg: "--c-header-button-hover-bg",
  headerLinkText: "--c-header-link-text",
  headerLinkHoverText: "--c-header-link-hover-text",
};
