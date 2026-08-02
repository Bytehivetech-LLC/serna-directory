import type { Theme } from "./defaults";

/** sRGB hex → relative luminance (WCAG 2.1). */
function relativeLuminance(hex: string): number {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

type Ref = keyof Theme | "white";

type PairDef = {
  label: string;
  fg: Ref;
  bg: keyof Theme;
  /** Minimum ratio — 4.5 for body text, 3 for large/UI text. */
  min: number;
  /**
   * Whether a failure blocks publish. Every critical text/UI pair blocks. The
   * `faint` token is intentionally low-contrast decorative text (timestamps,
   * hints) and the Serna brand default sits below 3:1, so it is surfaced as an
   * advisory rather than a hard block — otherwise the shipped default could
   * never be published or reset to.
   */
  blocking: boolean;
};

export const CONTRAST_PAIRS: PairDef[] = [
  { label: "Ink on page background", fg: "ink", bg: "bg", min: 4.5, blocking: true },
  { label: "Ink on card", fg: "ink", bg: "card", min: 4.5, blocking: true },
  { label: "Muted on card", fg: "muted", bg: "card", min: 4.5, blocking: true },
  { label: "Faint on card", fg: "faint", bg: "card", min: 3, blocking: false },
  { label: "Header text on header background", fg: "headerText", bg: "headerBg", min: 4.5, blocking: true },
  { label: "White on indigo", fg: "white", bg: "indigo", min: 4.5, blocking: true },
  { label: "White on violet", fg: "white", bg: "violet", min: 3, blocking: true },
  { label: "Good on good-soft", fg: "good", bg: "goodSoft", min: 3, blocking: true },
  { label: "Danger on danger-soft", fg: "danger", bg: "dangerSoft", min: 3, blocking: true },
];

export type ContrastResult = {
  label: string;
  ratio: number;
  min: number;
  pass: boolean;
  blocking: boolean;
  fgHex: string;
  bgHex: string;
};

function resolve(theme: Theme, ref: Ref): string {
  return ref === "white" ? "#ffffff" : theme[ref];
}

export function evaluateContrast(theme: Theme): ContrastResult[] {
  return CONTRAST_PAIRS.map((p) => {
    const fgHex = resolve(theme, p.fg);
    const bgHex = resolve(theme, p.bg);
    const ratio = contrastRatio(fgHex, bgHex);
    return {
      label: p.label,
      ratio: Math.round(ratio * 100) / 100,
      min: p.min,
      pass: ratio >= p.min,
      blocking: p.blocking,
      fgHex,
      bgHex,
    };
  });
}

/** The blocking failures — publish is refused while this is non-empty. */
export function blockingFailures(theme: Theme): ContrastResult[] {
  return evaluateContrast(theme).filter((r) => r.blocking && !r.pass);
}
