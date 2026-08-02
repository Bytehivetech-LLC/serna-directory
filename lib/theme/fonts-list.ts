/**
 * Curated font whitelist for the theme editor. Server actions validate the
 * chosen display/body fonts against this list — an arbitrary family name is
 * never written. Bricolage Grotesque and Inter are the self-hosted defaults;
 * the rest fall back gracefully through the font stack in to-css-vars.
 */
export const ALLOWED_FONTS = [
  "Bricolage Grotesque",
  "Inter",
  "Manrope",
  "Poppins",
  "Montserrat",
  "Work Sans",
  "Space Grotesk",
  "Nunito",
  "Source Sans 3",
  "DM Sans",
  "Playfair Display",
  "Fraunces",
  "Lora",
  "Merriweather",
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export function isAllowedFont(name: string): name is AllowedFont {
  return (ALLOWED_FONTS as readonly string[]).includes(name);
}
