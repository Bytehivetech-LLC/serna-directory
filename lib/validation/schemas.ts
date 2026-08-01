import { z } from "zod";

/**
 * Single source of truth for input validation. Client and server both import
 * from here; every Server Action / Route Handler re-validates with these
 * before touching the database. Error messages say what to fix.
 */

/* ----------------------------------------------------------- primitives -- */

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** Optional trimmed text; empty string is treated as "not provided". */
const optionalText = (max: number, label = "This field") =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional(),
  );

/** Optional URL; empty string is treated as "not provided". */
const optionalUrl = (max = 300) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .url("Enter a full URL, including https://")
      .max(max, "That URL is too long.")
      .optional(),
  );

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

/* ----------------------------------------------------------------- enums -- */

export const esaAnswerSchema = z.enum(["yes", "no", "unsure"], {
  error: "Choose Yes, No, or Not sure.",
});
export const billingIntervalSchema = z.enum(["one_time", "month", "year"]);
export const tagSelectionTypeSchema = z.enum(["single", "multiple"]);

/* --------------------------------------------------------------- listing -- */

export const socialLinksSchema = z
  .object({
    instagram: optionalUrl(200),
    facebook: optionalUrl(200),
    youtube: optionalUrl(200),
  })
  .partial();

export const listingCreateSchema = z.object({
  categoryId: z.string().uuid("Pick a category."),
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business name.")
    .max(120, "Business name is too long."),
  contactName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(120, "Name is too long."),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email so families can reach you.")
    .max(200),
  contactPhone: optionalText(40, "Phone"),
  showPhone: z.boolean().default(true),
  website: optionalUrl(300),
  description: z
    .string()
    .trim()
    .min(60, "Add a sentence or two so families know what you offer.")
    .max(5000, "That description is very long — trim it a little."),
  social: socialLinksSchema.optional(),
  city: optionalText(120, "City"),
  state: z.string().trim().max(40).default("AZ"),
  alsoServes: z.array(z.string().trim().max(120)).max(20).optional(),
  agesServed: optionalText(200, "Ages / grades"),
  rateText: optionalText(200, "Rate"),
  acceptsEsa: esaAnswerSchema,
  tagIds: z.array(z.string().uuid()).max(60).optional(),
  packageSlug: optionalText(80, "Package"),
});

export const listingUpdateSchema = listingCreateSchema
  .partial()
  .extend({ id: z.string().uuid() });

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type SocialLinks = z.infer<typeof socialLinksSchema>;

/* --------------------------------------------------------------- profile -- */

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(120, "Name is too long."),
  phone: optionalText(40, "Phone"),
  businessAddress: optionalText(300, "Address"),
  avatarUrl: optionalUrl(500),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/* --------------------------------------------------------------- inquiry -- */

export const inquiryCreateSchema = z.object({
  listingId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email.").max(200),
  phone: optionalText(40, "Phone"),
  message: z
    .string()
    .trim()
    .min(10, "Add a short message so the business can help you.")
    .max(2000, "Message is too long."),
  recaptchaToken: z.string().min(1).optional(),
});

export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

/* ---------------------------------------------------- admin entities ----- */

export const categoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: slug.optional(),
  description: optionalText(500, "Description"),
  icon: optionalText(60, "Icon"),
  agesLabel: optionalText(60, "Ages label"),
  rateLabel: optionalText(60, "Rate label"),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const tagGroupUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: slug.optional(),
  description: optionalText(300, "Description"),
  categoryId: z.string().uuid().nullable().optional(),
  selectionType: tagSelectionTypeSchema.default("multiple"),
  showInForm: z.boolean().default(true),
  showInFilter: z.boolean().default(true),
  showOnListing: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const tagUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid("Pick a tag group."),
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: slug.optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const packageUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: slug.optional(),
  tagline: optionalText(120, "Tagline"),
  description: optionalText(1000, "Description"),
  priceCents: z.number().int().min(0, "Price can't be negative."),
  currency: z.string().trim().length(3).toLowerCase().default("usd"),
  interval: billingIntervalSchema.default("year"),
  minListings: z.number().int().min(0).default(1),
  maxListings: z.number().int().min(0).nullable().optional(),
  maxImages: z.number().int().min(0).default(3),
  requiresApproval: z.boolean().default(true),
  allowsFeatured: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;
export type TagGroupUpsertInput = z.infer<typeof tagGroupUpsertSchema>;
export type TagUpsertInput = z.infer<typeof tagUpsertSchema>;
export type PackageUpsertInput = z.infer<typeof packageUpsertSchema>;
