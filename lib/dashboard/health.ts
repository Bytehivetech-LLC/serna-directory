import "server-only";
import { getListFormConfig } from "@/lib/list-form/queries";
import {
  computeStrength,
  nextSuggestion,
  type FormValues,
} from "@/lib/list-form/strength";
import type { Listing } from "@/types";

export type ListingHealth = { percent: number; suggestion: string | null };

/** Reuse the listing-strength maths as a per-listing "health" score. */
export async function getListingHealth(
  listing: Listing,
  imageCount: number,
): Promise<ListingHealth> {
  const config = await getListFormConfig();
  const values: FormValues = {};
  for (const section of config.sections) {
    for (const field of section.fields) {
      if (!field.columnName) continue;
      const raw = (listing as Record<string, unknown>)[field.columnName];
      values[field.key] = raw == null ? "" : String(raw);
    }
  }
  const strength = computeStrength(config, values, imageCount);
  return {
    percent: strength.percent,
    suggestion: nextSuggestion(config, values, imageCount),
  };
}
