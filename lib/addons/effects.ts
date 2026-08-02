/** The effects an add-on can grant. `effect_value`/`duration_days` apply per the flags. */
export const ADDON_EFFECTS = [
  {
    value: "manual",
    label: "Manual fulfilment",
    hint: "A human does it — newsletter, social post. Lands in the fulfilment queue.",
    needsValue: false,
    needsDuration: true,
  },
  {
    value: "extra_images",
    label: "Extra photos",
    hint: "Raises the gallery limit by the effect value.",
    needsValue: true,
    needsDuration: false,
  },
  {
    value: "extra_listings",
    label: "Extra listings",
    hint: "Raises the account listing limit by the effect value.",
    needsValue: true,
    needsDuration: false,
  },
  {
    value: "featured_days",
    label: "Featured placement",
    hint: "Featured for the duration in days.",
    needsValue: false,
    needsDuration: true,
  },
  {
    value: "homepage_slot",
    label: "Homepage spotlight",
    hint: "Appears in the homepage spotlight rail.",
    needsValue: false,
    needsDuration: true,
  },
  {
    value: "video_embed",
    label: "Video embed",
    hint: "Unlocks the video field on the listing.",
    needsValue: false,
    needsDuration: false,
  },
  {
    value: "priority_boost",
    label: "Search priority boost",
    hint: "Adds the effect value to search priority.",
    needsValue: true,
    needsDuration: false,
  },
  {
    value: "inquiry_alerts",
    label: "Instant inquiry alerts",
    hint: "Instant inquiry emails instead of the daily digest.",
    needsValue: false,
    needsDuration: false,
  },
  {
    value: "verified_badge",
    label: "Verified badge",
    hint: "Displays the verified badge on the listing.",
    needsValue: false,
    needsDuration: false,
  },
] as const;

export type AddonEffect = (typeof ADDON_EFFECTS)[number]["value"];

export const ADDON_EFFECT_VALUES = ADDON_EFFECTS.map((e) => e.value) as [
  AddonEffect,
  ...AddonEffect[],
];

export function effectLabel(effect: string): string {
  return ADDON_EFFECTS.find((e) => e.value === effect)?.label ?? effect;
}
