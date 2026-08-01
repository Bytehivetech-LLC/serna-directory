import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, EsaAnswer, ListingStatus } from "@/types";
import type {
  ListingDetail,
  ListingImage,
  ListingTagGroup,
  SocialLinks,
} from "./types";

const IMAGE_BUCKET = "listing-images";

function pickSocial(value: unknown): SocialLinks {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const out: SocialLinks = {};
  for (const key of ["instagram", "facebook", "youtube"] as const) {
    if (typeof v[key] === "string" && (v[key] as string).trim()) {
      out[key] = (v[key] as string).trim();
    }
  }
  return out;
}

/**
 * Load a listing by slug for the detail page. RLS decides visibility: published
 * listings resolve for everyone; drafts/pending only for the owner or staff. A
 * row the viewer can't see comes back null → the page 404s. Soft-deleted rows
 * are treated as missing.
 */
export const getListingBySlug = cache(async (
  slug: string,
): Promise<ListingDetail | null> => {
  const supabase = await createClient();

  const { data: l } = await supabase
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!l || l.deleted_at) return null;

  return mapListingDetail(supabase, l);
});

/**
 * Build the full ListingDetail from a listings row. Shared by the public
 * (RLS-gated) loader and the admin (service-role) loader so both render the
 * exact same shape.
 */
export async function mapListingDetail(
  supabase: SupabaseClient<Database>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l: any,
): Promise<ListingDetail> {
  const publicUrl = (path: string | null | undefined) =>
    path ? supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl : "";

  const [categoryRes, imagesRes, listingTagsRes] = await Promise.all([
    l.category_id
      ? supabase
          .from("categories")
          .select("name, slug, ages_label, rate_label")
          .eq("id", l.category_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", l.id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase.from("listing_tags").select("tag_id").eq("listing_id", l.id),
  ]);

  const category = categoryRes.data;

  const images: ListingImage[] = (imagesRes.data ?? []).map((img) => ({
    id: img.id,
    url: publicUrl(img.storage_path),
    thumbUrl: publicUrl(img.thumb_path ?? img.storage_path),
    alt: img.alt_text ?? l.business_name,
    isCover: Boolean(img.is_cover),
  }));

  // Tags + their groups.
  const tagIds = (listingTagsRes.data ?? []).map((t) => t.tag_id);
  const groupsById = new Map<string, ListingTagGroup>();
  if (tagIds.length) {
    const { data: tags } = await supabase
      .from("tags")
      .select("id, name, slug, group_id")
      .in("id", tagIds);
    const groupIds = Array.from(
      new Set((tags ?? []).map((t) => t.group_id).filter(Boolean)),
    ) as string[];
    const { data: groups } = groupIds.length
      ? await supabase
          .from("tag_groups")
          .select("id, name, slug, category_id, show_on_listing, sort_order")
          .in("id", groupIds)
      : { data: [] };

    for (const g of groups ?? []) {
      groupsById.set(g.id, {
        id: g.id,
        name: g.name,
        slug: g.slug,
        categoryId: g.category_id,
        showOnListing: Boolean(g.show_on_listing),
        sortOrder: g.sort_order ?? 0,
        tags: [],
      });
    }
    for (const t of tags ?? []) {
      const group = t.group_id ? groupsById.get(t.group_id) : undefined;
      if (group) group.tags.push({ id: t.id, name: t.name, slug: t.slug });
    }
  }

  const allGroups = Array.from(groupsById.values()).map((g) => ({
    ...g,
    tags: g.tags.sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const subjectGroup =
    allGroups.find((g) => g.categoryId && g.categoryId === l.category_id) ??
    null;
  const otherGroups = allGroups
    .filter((g) => g.showOnListing && g.id !== subjectGroup?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: l.id,
    slug: l.slug ?? "",
    status: (l.status as ListingStatus) ?? "draft",
    businessName: l.business_name,
    categoryId: l.category_id,
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
    agesLabel: category?.ages_label || "Ages / grades",
    rateLabel: category?.rate_label || "Rate",
    city: l.city,
    state: l.state,
    address: l.address_line,
    alsoServes: Array.isArray(l.also_serves) ? l.also_serves : [],
    description: l.description,
    descriptionHtml: l.description_html,
    website: l.website,
    contactPhone: l.contact_phone,
    showPhone: Boolean(l.show_phone),
    contactEmail: l.contact_email,
    social: pickSocial(l.social),
    agesServed: l.ages_served,
    rateText: l.rate_text,
    acceptsEsa: (l.accepts_esa as EsaAnswer) ?? null,
    isFeatured: Boolean(l.is_featured),
    lat: l.latitude,
    lng: l.longitude,
    ownerId: l.owner_id,
    images,
    subjectGroup,
    otherGroups,
  };
}
