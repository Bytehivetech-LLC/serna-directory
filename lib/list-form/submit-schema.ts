import { z } from "zod";

const optional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/** Core fields, keyed by their real listing column names. */
export const coreSchema = z.object({
  business_name: z.string().trim().min(2, "Enter your business name.").max(120),
  contact_name: z.string().trim().min(1, "Enter your name.").max(120),
  contact_email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email.")
    .max(200),
  contact_phone: optional(40),
  website: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().url("Enter a full URL, including https://").max(300).optional(),
  ),
  description: z
    .string()
    .trim()
    .min(60, "Add a sentence or two describing your business.")
    .max(5000),
  address_line: optional(200),
  city: optional(120),
  state: optional(40),
  postal_code: optional(20),
  also_serves: optional(300),
  ages_served: optional(200),
  rate_text: optional(200),
  accepts_esa: z.enum(["yes", "no", "unsure"], {
    error: "Choose Yes, No, or Not sure.",
  }),
});

export const listingSubmitSchema = z.object({
  categorySlug: z.string().min(1, "Pick a category."),
  packageSlug: z.string().min(1),
  core: coreSchema,
  showPhone: z.boolean().default(true),
  tagSlugs: z.array(z.string()).max(80).default([]),
  geo: z
    .object({
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      google_place_id: z.string().nullable(),
    })
    .partial()
    .optional(),
  customFields: z.record(z.string(), z.string()).default({}),
  imageCount: z.number().int().min(0).max(30).default(0),
  addons: z
    .array(
      z.object({
        addonId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .max(20)
    .default([]),
  recaptchaToken: z.string().optional(),
});

export type ListingSubmitInput = z.infer<typeof listingSubmitSchema>;
export type CoreInput = z.infer<typeof coreSchema>;
