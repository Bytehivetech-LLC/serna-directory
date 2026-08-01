"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { requireOwnedListing } from "./guards";
import { getOwnerListings, getListingLimit } from "./queries";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/** Soft delete — sets deleted_at + archives; the file cleanup is handled by the DB queue. */
export async function softDeleteListingAction(id: string): Promise<ActionResult> {
  const { user, listing } = await requireOwnedListing(id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", listing.id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: "Couldn't delete that listing." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  return { ok: true };
}

export async function unpublishListingAction(id: string): Promise<ActionResult> {
  const { user, listing } = await requireOwnedListing(id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ status: "unpublished" })
    .eq("id", listing.id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: "Couldn't unpublish that listing." };
  revalidatePath("/dashboard/listings");
  revalidatePath(`/dashboard/listings/${listing.id}`);
  return { ok: true };
}

export async function duplicateListingAction(id: string): Promise<ActionResult> {
  const { user, listing } = await requireOwnedListing(id);
  const supabase = await createClient();

  const [existing, limit] = await Promise.all([
    getOwnerListings(user.id),
    getListingLimit(user.id),
  ]);
  if (existing.length >= limit) {
    return {
      ok: false,
      error: `You've reached your plan's limit of ${limit} listing${limit === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }

  const slug = `${slugify(listing.business_name) || "listing"}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: copy, error } = await supabase
    .from("listings")
    .insert({
      owner_id: user.id,
      category_id: listing.category_id,
      status: "draft",
      slug,
      business_name: `${listing.business_name} (copy)`,
      contact_name: listing.contact_name,
      contact_email: listing.contact_email,
      contact_phone: listing.contact_phone,
      show_phone: listing.show_phone,
      website: listing.website,
      description: listing.description,
      description_html: listing.description_html,
      address_line: listing.address_line,
      city: listing.city,
      state: listing.state,
      postal_code: listing.postal_code,
      country: listing.country,
      also_serves: listing.also_serves,
      ages_served: listing.ages_served,
      rate_text: listing.rate_text,
      accepts_esa: listing.accepts_esa,
      latitude: listing.latitude,
      longitude: listing.longitude,
      custom_fields: listing.custom_fields,
    })
    .select("id")
    .single();
  if (error || !copy) return { ok: false, error: "Couldn't duplicate that listing." };

  // Copy tags.
  const { data: tags } = await supabase
    .from("listing_tags")
    .select("tag_id")
    .eq("listing_id", listing.id);
  if (tags?.length) {
    await supabase
      .from("listing_tags")
      .insert(tags.map((t) => ({ listing_id: copy.id, tag_id: t.tag_id })));
  }

  revalidatePath("/dashboard/listings");
  return { ok: true, id: copy.id };
}

export async function markInquiriesReadAction(
  listingId: string,
): Promise<ActionResult> {
  const { listing } = await requireOwnedListing(listingId);
  const supabase = await createClient();
  await supabase
    .from("inquiries")
    .update({ status: "read" })
    .eq("listing_id", listing.id)
    .eq("status", "new");
  revalidatePath(`/dashboard/listings/${listing.id}/inquiries`);
  return { ok: true };
}
