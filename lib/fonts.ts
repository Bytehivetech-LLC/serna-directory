import { Bricolage_Grotesque, Inter } from "next/font/google";

/**
 * Default brand fonts, loaded and self-hosted by next/font. Each exposes a CSS
 * variable that the theme's font stack points at (see lib/theme/to-css-vars).
 * Both are variable fonts, so we load the full weight range.
 */
export const fontBricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const fontInter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
