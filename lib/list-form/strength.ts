import type { FormField, ListFormConfig } from "./types";

export type FormValues = Record<string, string | undefined>;

/** Image points: first three photos add 5 each (matches the prototype). */
const IMAGE_POINTS_MAX = 15;
const imagePoints = (n: number) => Math.min(n, 3) * 5;

function hasValue(field: FormField, value: string | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (field.type === "email") return /.+@.+\..+/.test(v);
  return true;
}

/** All fields across all sections (subjects/tags counted separately). */
function allFields(config: ListFormConfig): FormField[] {
  return config.sections.flatMap((s) => s.fields);
}

export function computeStrength(
  config: ListFormConfig,
  values: FormValues,
  imageCount: number,
): { percent: number; earned: number; max: number } {
  let earned = 0;
  for (const field of allFields(config)) {
    if (hasValue(field, values[field.key])) earned += field.strengthPoints;
  }
  earned += imagePoints(imageCount);
  const max = config.maxFieldPoints + IMAGE_POINTS_MAX;
  const percent = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0;
  return { percent, earned, max };
}

/** Labels of required fields still missing a value (for "to publish, add…"). */
export function missingRequired(
  config: ListFormConfig,
  values: FormValues,
  categorySelected: boolean,
): string[] {
  const missing: string[] = [];
  if (!categorySelected) missing.push("a category");
  for (const field of allFields(config)) {
    if (field.isRequired && !hasValue(field, values[field.key])) {
      missing.push(field.label.toLowerCase());
    }
  }
  return missing;
}

/** The single best next suggestion once the listing is publishable. */
export function nextSuggestion(
  config: ListFormConfig,
  values: FormValues,
  imageCount: number,
): string | null {
  if (imageCount === 0) return "Add a photo or two for a big boost.";
  const descField = allFields(config).find((f) => f.type === "textarea");
  if (descField) {
    const desc = (values[descField.key] ?? "").trim();
    if (desc.length < 400) return "A longer description earns full points.";
  }
  return "Add tags so families can filter to you.";
}
