/** Realistic sample values for the email editor preview + variable menu. Never
 * lorem ipsum, never raw braces — a plausible listing an admin can picture. */
export const SAMPLE_VALUES: Record<string, string> = {
  owner_name: "Maria Delgado",
  enquirer_name: "Jordan Blake",
  enquirer_email: "jordan.blake@example.com",
  listing_name: "Sonoran Sky Learning Co-op",
  business_name: "Sonoran Sky Learning Co-op",
  listing_path: "https://directory.sernaeducationalservices.com/listing/sonoran-sky",
  edit_link: "https://directory.sernaeducationalservices.com/dashboard/listings/123/edit",
  extras_link: "https://directory.sernaeducationalservices.com/dashboard/listings/123/extras",
  magic_link: "https://directory.sernaeducationalservices.com/auth/callback?token=sample",
  reason: "Please add a short description and at least one photo.",
  message: "Hi! Do you have openings for a 3rd grader this fall? Thanks!",
  review_days: "2",
  grace_days: "7",
  total: "$75.00",
  items: "1× Newsletter spotlight, 10× Extra photos",
  addon_name: "Newsletter spotlight",
  expires_on: "2026-09-14",
  note: "Featured in the Friday 8/29 newsletter.",
  line_items: "Featured upgrade — $49/yr",
  receipt_url: "https://directory.sernaeducationalservices.com/dashboard/billing",
  next_steps: "Your Featured upgrade is active.",
  grace_period: "30",
};

export function sampleFor(name: string): string {
  return SAMPLE_VALUES[name] ?? `«${name}»`;
}

/** Build a preview context from a template's declared variable names. */
export function sampleContext(names: string[]): Record<string, string> {
  const ctx: Record<string, string> = {};
  for (const n of names) ctx[n] = sampleFor(n);
  return ctx;
}
