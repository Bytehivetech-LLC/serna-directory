/**
 * Turn arbitrary text into a URL-safe slug:
 *   "Serna's Micro-School!" -> "sernas-micro-school"
 * Lowercases, strips accents, collapses non-alphanumerics to single dashes,
 * and trims leading/trailing dashes.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Append a short suffix to keep a slug unique, e.g. slugify + "-2".
 * Falls back to "listing" when the base slugifies to an empty string.
 */
export function slugWithSuffix(input: string, suffix?: string | number): string {
  const base = slugify(input) || "listing";
  return suffix === undefined || suffix === null || suffix === ""
    ? base
    : `${base}-${suffix}`;
}
