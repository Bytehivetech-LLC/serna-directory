"use server";

import { headers } from "next/headers";
import DOMPurify from "isomorphic-dompurify";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { checkRateLimit, minutesUntil } from "@/lib/utils/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { geocodeAddress } from "@/lib/geo/geocode";
import { zodErrorToFieldErrors } from "@/lib/forms";
import { listingSubmitSchema, type ListingSubmitInput } from "./submit-schema";

const BUCKET = "listing-images";

export type UploadTarget = {
  fullPath: string;
  fullToken: string;
  thumbPath: string;
  thumbToken: string;
};

export type SubmitResult =
  | {
      ok: true;
      listingId: string;
      slug: string;
      featured: boolean;
      uploads: UploadTarget[];
    }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

function descriptionHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return DOMPurify.sanitize(paragraphs, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export async function submitListingAction(
  input: ListingSubmitInput,
): Promise<SubmitResult> {
  const parsed = listingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = clientIp(h);
  const limit = await checkRateLimit(`listing-submit:ip:${ip}`, 5, 60 * 60);
  if (!limit.allowed) {
    const mins = minutesUntil(limit.resetAt);
    return {
      ok: false,
      error: `You've submitted a few listings already. Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  const captcha = await verifyRecaptcha(data.recaptchaToken, "list_program");
  if (!captcha.ok) {
    return { ok: false, error: captcha.reason ?? "Verification failed." };
  }

  const admin = createAdminClient();

  const [{ data: category }, { data: pkg }] = await Promise.all([
    admin
      .from("categories")
      .select("id")
      .eq("slug", data.categorySlug)
      .maybeSingle(),
    admin
      .from("packages")
      .select("id, allows_featured, requires_approval")
      .eq("slug", data.packageSlug)
      .maybeSingle(),
  ]);
  if (!category || !pkg) {
    return { ok: false, error: "That category or plan is no longer available." };
  }

  // Provision the owner account (sanctioned service-role use). Created without a
  // password — the Phase 7 account flow sends a set-password link.
  const email = data.core.contact_email;
  let ownerId: string | null = null;
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    ownerId = existing.id;
  } else {
    const { data: created } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: data.core.contact_name },
    });
    ownerId = created?.user?.id ?? null;
    if (ownerId) {
      await admin.from("profiles").upsert({
        id: ownerId,
        email,
        full_name: data.core.contact_name,
        role: "user",
      });
    }
  }
  if (!ownerId) {
    return { ok: false, error: "We couldn't set up your account. Please try again." };
  }

  const slug = `${slugify(data.core.business_name) || "listing"}-${crypto.randomUUID().slice(0, 6)}`;
  const alsoServes = (data.core.also_serves ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Coordinates: prefer Places; otherwise geocode the manual address server-side.
  let latitude = data.geo?.latitude ?? null;
  let longitude = data.geo?.longitude ?? null;
  let googlePlaceId = data.geo?.google_place_id ?? null;
  if (latitude == null && (data.core.address_line || data.core.city)) {
    const g = await geocodeAddress({
      address_line: data.core.address_line,
      city: data.core.city,
      state: data.core.state,
      postal_code: data.core.postal_code,
    });
    if (g) {
      latitude = g.lat;
      longitude = g.lng;
      googlePlaceId = googlePlaceId ?? g.placeId;
    }
  }

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .insert({
      owner_id: ownerId,
      category_id: category.id,
      package_id: pkg.id,
      status: "pending_review",
      slug,
      business_name: data.core.business_name,
      contact_name: data.core.contact_name,
      contact_email: email,
      contact_phone: data.core.contact_phone ?? null,
      show_phone: data.showPhone,
      website: data.core.website ?? null,
      description: data.core.description,
      description_html: descriptionHtml(data.core.description),
      address_line: data.core.address_line ?? null,
      city: data.core.city ?? null,
      state: data.core.state ?? null,
      postal_code: data.core.postal_code ?? null,
      country: "US",
      also_serves: alsoServes,
      ages_served: data.core.ages_served ?? null,
      rate_text: data.core.rate_text ?? null,
      accepts_esa: data.core.accepts_esa,
      latitude,
      longitude,
      google_place_id: googlePlaceId,
      custom_fields: data.customFields,
      submitted_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();
  if (listingError || !listing) {
    return { ok: false, error: "We couldn't create your listing. Please try again." };
  }

  // Attach tags.
  if (data.tagSlugs.length) {
    const { data: tags } = await admin
      .from("tags")
      .select("id")
      .in("slug", data.tagSlugs);
    if (tags?.length) {
      await admin
        .from("listing_tags")
        .insert(tags.map((t) => ({ listing_id: listing.id, tag_id: t.id })));
    }
  }

  // Image allowance from entitlements (the ONLY source of truth), then
  // pre-create rows + signed upload URLs for the browser to push blobs into.
  let maxImages = 8;
  const { data: ent } = await admin.rpc("listing_entitlements", {
    p_listing_id: listing.id,
  });
  const entRow = Array.isArray(ent) ? ent[0] : ent;
  if (entRow && typeof (entRow as { max_images?: number }).max_images === "number") {
    maxImages = (entRow as { max_images: number }).max_images;
  }

  const uploads: UploadTarget[] = [];
  const count = Math.min(data.imageCount, maxImages);
  for (let i = 0; i < count; i++) {
    const uuid = crypto.randomUUID();
    const fullPath = `${listing.id}/${uuid}.webp`;
    const thumbPath = `${listing.id}/${uuid}_thumb.webp`;
    const [full, thumb] = await Promise.all([
      admin.storage.from(BUCKET).createSignedUploadUrl(fullPath),
      admin.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (!full.data || !thumb.data) continue;
    uploads.push({
      fullPath,
      fullToken: full.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    });
    await admin.from("listing_images").insert({
      listing_id: listing.id,
      storage_path: fullPath,
      thumb_path: thumbPath,
      is_cover: i === 0,
      sort_order: i,
      alt_text: data.core.business_name,
    });
  }

  return {
    ok: true,
    listingId: listing.id,
    slug: listing.slug ?? slug,
    featured: false,
    uploads,
  };
}
