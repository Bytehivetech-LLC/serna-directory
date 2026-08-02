"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { requireOwnedListing } from "@/lib/dashboard/guards";
import { getOwnerListings, getListingLimit } from "@/lib/dashboard/queries";
import { slugify } from "@/lib/utils/slug";
import { geocodeAddress } from "@/lib/geo/geocode";
import { getSettings } from "@/lib/settings";
import { sendTemplateEmail } from "@/lib/email/send";
import { zodErrorToFieldErrors } from "@/lib/forms";
import { createExtrasCheckoutAction } from "@/lib/stripe/addon-checkout";
import { listingSubmitSchema, type ListingSubmitInput } from "./submit-schema";
import type { SubmitResult, UploadTarget } from "./actions";

const BUCKET = "listing-images";

/** Material fields — changing any of these on a live listing can trigger re-review. */
type MaterialSnapshot = {
  business_name: string;
  description: string | null;
  category_id: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

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

function siteOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Best-effort geocode when the browser didn't already resolve coordinates. */
async function resolveGeo(
  data: ListingSubmitInput,
): Promise<{ latitude: number | null; longitude: number | null; googlePlaceId: string | null }> {
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
  return { latitude, longitude, googlePlaceId };
}

/**
 * Signs upload URLs for `count` new photos AND records their DB rows, all under
 * the owner's RLS session (never the service role). `startOrder` continues the
 * sort order after any existing photos; `coverStart` makes the first new photo
 * the cover only when the listing has none yet.
 */
async function signUploads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  businessName: string,
  count: number,
  startOrder: number,
  makeFirstCover: boolean,
): Promise<UploadTarget[]> {
  const uploads: UploadTarget[] = [];
  for (let i = 0; i < count; i++) {
    const uuid = crypto.randomUUID();
    const fullPath = `${listingId}/${uuid}.webp`;
    const thumbPath = `${listingId}/${uuid}_thumb.webp`;
    const [full, thumb] = await Promise.all([
      supabase.storage.from(BUCKET).createSignedUploadUrl(fullPath),
      supabase.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (!full.data || !thumb.data) continue;
    uploads.push({
      fullPath,
      fullToken: full.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    });
    await supabase.from("listing_images").insert({
      listing_id: listingId,
      storage_path: fullPath,
      thumb_path: thumbPath,
      is_cover: makeFirstCover && i === 0,
      sort_order: startOrder + i,
      alt_text: businessName,
    });
  }
  return uploads;
}

// ---------------------------------------------------------------------------
// Create — authenticated owner adds a new listing from the dashboard.
// ---------------------------------------------------------------------------
export async function createOwnerListingAction(
  input: ListingSubmitInput,
): Promise<SubmitResult> {
  const user = await requireUser();

  const parsed = listingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // Re-check the plan limit server-side — never trust the browser.
  const [existing, limit] = await Promise.all([
    getOwnerListings(user.id),
    getListingLimit(user.id),
  ]);
  if (existing.length >= limit) {
    return {
      ok: false,
      error: `You've reached your plan's limit of ${limit} listing${limit === 1 ? "" : "s"}. Upgrade to add another.`,
    };
  }

  const [{ data: category }, { data: pkg }] = await Promise.all([
    supabase.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle(),
    supabase
      .from("packages")
      .select("id, allows_featured, requires_approval, price_cents")
      .eq("slug", data.packageSlug)
      .maybeSingle(),
  ]);
  if (!category || !pkg) {
    return { ok: false, error: "That category or plan is no longer available." };
  }

  const { latitude, longitude, googlePlaceId } = await resolveGeo(data);
  const status = pkg.requires_approval ? "pending_review" : "published";
  const slug = `${slugify(data.core.business_name) || "listing"}-${crypto.randomUUID().slice(0, 6)}`;
  const alsoServes = (data.core.also_serves ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const nowIso = new Date().toISOString();

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      owner_id: user.id,
      category_id: category.id,
      package_id: pkg.id,
      status,
      slug,
      business_name: data.core.business_name,
      contact_name: data.core.contact_name,
      contact_email: data.core.contact_email,
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
      submitted_at: nowIso,
      published_at: status === "published" ? nowIso : null,
    })
    .select("id, slug")
    .single();
  if (error || !listing) {
    return { ok: false, error: "We couldn't create your listing. Please try again." };
  }

  if (data.tagSlugs.length) {
    const { data: tags } = await supabase
      .from("tags")
      .select("id")
      .in("slug", data.tagSlugs);
    if (tags?.length) {
      await supabase
        .from("listing_tags")
        .insert(tags.map((t) => ({ listing_id: listing.id, tag_id: t.id })));
    }
  }

  // Photo allowance from entitlements, then signed upload URLs + rows.
  let maxImages = 8;
  const { data: ent } = await supabase.rpc("listing_entitlements", {
    p_listing_id: listing.id,
  });
  const entRow = Array.isArray(ent) ? ent[0] : ent;
  if (entRow && typeof (entRow as { max_images?: number }).max_images === "number") {
    maxImages = (entRow as { max_images: number }).max_images;
  }
  const uploads = await signUploads(
    supabase,
    listing.id,
    data.core.business_name,
    Math.min(data.imageCount, maxImages),
    0,
    true,
  );

  // Confirmation email (parity with the public flow).
  const settings = await getSettings(["review_sla_days"]);
  const reviewDays =
    typeof settings.review_sla_days === "number" ? settings.review_sla_days : 2;
  const origin = siteOrigin(await headers());
  await sendTemplateEmail("listing_submitted", {
    to: data.core.contact_email,
    userId: user.id,
    listingId: listing.id,
    context: {
      owner_name: data.core.contact_name,
      listing_name: data.core.business_name,
      listing_path: `${origin}/listing/${listing.slug}`,
      review_days: reviewDays,
    },
  });

  // Add-ons selected during create → checkout for them (authenticated owner).
  let checkoutUrl: string | null = null;
  if (data.addons.length) {
    const co = await createExtrasCheckoutAction({
      listingId: listing.id,
      addons: data.addons,
    });
    if (co.ok) checkoutUrl = co.url;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  return {
    ok: true,
    mode: "signed_in",
    listingId: listing.id,
    slug: listing.slug ?? slug,
    featured: pkg.price_cents > 0 && pkg.allows_featured,
    uploads,
    checkoutUrl,
  };
}

// ---------------------------------------------------------------------------
// Update — authenticated owner edits one of their own listings.
// ---------------------------------------------------------------------------
export async function updateOwnerListingAction(
  id: string,
  input: ListingSubmitInput,
): Promise<SubmitResult> {
  // Re-check ownership on every edit — the id in the URL is never trusted.
  const { user, listing: current } = await requireOwnedListing(id);

  const parsed = listingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const [{ data: category }, { data: pkg }] = await Promise.all([
    supabase.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle(),
    supabase
      .from("packages")
      .select("id, allows_featured, requires_approval, price_cents")
      .eq("slug", data.packageSlug)
      .maybeSingle(),
  ]);
  if (!category || !pkg) {
    return { ok: false, error: "That category or plan is no longer available." };
  }

  const { latitude, longitude, googlePlaceId } = await resolveGeo(data);
  const alsoServes = (data.core.also_serves ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Re-review rule: only a LIVE listing on an approval-required plan, and only
  // when a material field actually changed, goes back to pending_review.
  const before: MaterialSnapshot = {
    business_name: current.business_name,
    description: current.description,
    category_id: current.category_id,
    address_line: current.address_line,
    city: current.city,
    state: current.state,
    postal_code: current.postal_code,
  };
  const after: MaterialSnapshot = {
    business_name: data.core.business_name,
    description: data.core.description,
    category_id: category.id,
    address_line: data.core.address_line ?? null,
    city: data.core.city ?? null,
    state: data.core.state ?? null,
    postal_code: data.core.postal_code ?? null,
  };
  const materialChanged = (Object.keys(before) as (keyof MaterialSnapshot)[]).some(
    (k) => (before[k] ?? "") !== (after[k] ?? ""),
  );
  const needsReview =
    current.status === "published" && pkg.requires_approval && materialChanged;
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("listings")
    .update({
      category_id: category.id,
      package_id: pkg.id,
      status: needsReview ? "pending_review" : current.status,
      business_name: data.core.business_name,
      contact_name: data.core.contact_name,
      contact_email: data.core.contact_email,
      contact_phone: data.core.contact_phone ?? null,
      show_phone: data.showPhone,
      website: data.core.website ?? null,
      description: data.core.description,
      description_html: descriptionHtml(data.core.description),
      address_line: data.core.address_line ?? null,
      city: data.core.city ?? null,
      state: data.core.state ?? null,
      postal_code: data.core.postal_code ?? null,
      also_serves: alsoServes,
      ages_served: data.core.ages_served ?? null,
      rate_text: data.core.rate_text ?? null,
      accepts_esa: data.core.accepts_esa,
      latitude,
      longitude,
      google_place_id: googlePlaceId,
      custom_fields: data.customFields,
      submitted_at: needsReview ? nowIso : current.submitted_at,
    })
    .eq("id", current.id)
    .eq("owner_id", user.id);
  if (error) {
    return { ok: false, error: "We couldn't save your changes. Please try again." };
  }

  // Replace tags.
  await supabase.from("listing_tags").delete().eq("listing_id", current.id);
  if (data.tagSlugs.length) {
    const { data: tags } = await supabase
      .from("tags")
      .select("id")
      .in("slug", data.tagSlugs);
    if (tags?.length) {
      await supabase
        .from("listing_tags")
        .insert(tags.map((t) => ({ listing_id: current.id, tag_id: t.id })));
    }
  }

  // New photos: only as many as the remaining allowance permits.
  let maxImages = 8;
  const { data: ent } = await supabase.rpc("listing_entitlements", {
    p_listing_id: current.id,
  });
  const entRow = Array.isArray(ent) ? ent[0] : ent;
  if (entRow && typeof (entRow as { max_images?: number }).max_images === "number") {
    maxImages = (entRow as { max_images: number }).max_images;
  }
  const { count: existingCount } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", current.id);
  const already = existingCount ?? 0;
  const room = Math.max(0, maxImages - already);
  const uploads = await signUploads(
    supabase,
    current.id,
    data.core.business_name,
    Math.min(data.imageCount, room),
    already,
    already === 0,
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath(`/dashboard/listings/${current.id}`);
  revalidatePath(`/listing/${current.slug}`);
  return {
    ok: true,
    mode: "signed_in",
    listingId: current.id,
    slug: current.slug ?? "",
    featured: Boolean(current.is_featured),
    uploads,
  };
}

// ---------------------------------------------------------------------------
// Delete a photo from a listing the caller owns. The DB queue removes the file.
// ---------------------------------------------------------------------------
export async function deleteOwnerListingImageAction(
  imageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("listing_images")
    .select("id, listing_id, is_cover, listings!inner(owner_id)")
    .eq("id", imageId)
    .maybeSingle();
  const ownerId = (image as { listings?: { owner_id?: string } } | null)?.listings
    ?.owner_id;
  if (!image || ownerId !== user.id) {
    return { ok: false, error: "That photo isn't yours to remove." };
  }

  const { error } = await supabase.from("listing_images").delete().eq("id", image.id);
  if (error) return { ok: false, error: "Couldn't remove that photo." };

  // If we removed the cover, promote the next photo so the listing keeps one.
  if (image.is_cover) {
    const { data: next } = await supabase
      .from("listing_images")
      .select("id")
      .eq("listing_id", image.listing_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("listing_images")
        .update({ is_cover: true })
        .eq("id", next.id);
    }
  }

  revalidatePath(`/dashboard/listings/${image.listing_id}`);
  return { ok: true };
}
