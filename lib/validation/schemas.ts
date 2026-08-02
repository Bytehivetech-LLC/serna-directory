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

/**
 * One social field. Accepts a full URL OR a bare handle ("@sernaedu"), strips
 * the leading @, tracking params and trailing slash, forces https, and rejects a
 * URL whose host doesn't belong to this network — so a Facebook URL can't land
 * in the Instagram field. Empty → undefined.
 */
function socialField(opts: {
  label: string;
  hosts: string[];
  fromHandle: (handle: string) => string;
}) {
  return z
    .string()
    .trim()
    .max(300, `${opts.label} link is too long.`)
    .optional()
    .transform((value, ctx) => {
      const raw = (value ?? "").trim();
      if (!raw) return undefined;

      // Bare handle (no protocol, no dot) → build the canonical URL.
      let s =
        !/^https?:\/\//i.test(raw) && !raw.includes(".")
          ? opts.fromHandle(raw.replace(/^@+/, ""))
          : raw.replace(/^http:\/\//i, "https://");
      if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

      let url: URL;
      try {
        url = new URL(s);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a valid ${opts.label} link.` });
        return z.NEVER;
      }
      url.protocol = "https:";
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();
      if (!opts.hosts.includes(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `That doesn't look like a ${opts.label} link.`,
        });
        return z.NEVER;
      }
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    });
}

export const socialLinksSchema = z
  .object({
    facebook: socialField({
      label: "Facebook",
      hosts: ["facebook.com", "fb.com", "m.facebook.com"],
      fromHandle: (h) => `https://facebook.com/${h}`,
    }),
    instagram: socialField({
      label: "Instagram",
      hosts: ["instagram.com"],
      fromHandle: (h) => `https://instagram.com/${h}`,
    }),
    linkedin: socialField({
      label: "LinkedIn",
      hosts: ["linkedin.com"],
      fromHandle: (h) => `https://linkedin.com/company/${h}`,
    }),
    youtube: socialField({
      label: "YouTube",
      hosts: ["youtube.com", "youtu.be"],
      fromHandle: (h) => `https://youtube.com/@${h}`,
    }),
    tiktok: socialField({
      label: "TikTok",
      hosts: ["tiktok.com"],
      fromHandle: (h) => `https://tiktok.com/@${h}`,
    }),
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

/* ------------------------------------------------------------------ auth -- */

const email = z.string().trim().toLowerCase().email("Enter a valid email.").max(200);

/** New-password rules. 72 is bcrypt's byte ceiling. */
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords can be at most 72 characters.");

/** Coerce an HTML checkbox ("on"/absent) to a boolean. */
const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  recaptchaToken: z.string().optional(),
  next: z.string().optional(),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email,
  password: newPassword,
  acceptTerms: checkbox.refine((v) => v === true, {
    error: "Please accept the terms to continue.",
  }),
  recaptchaToken: z.string().optional(),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    error: "Those passwords don't match.",
  });

export const changePasswordSchema = z
  .object({
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    error: "Those passwords don't match.",
  });

export const mfaVerifySchema = z.object({
  factorId: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
