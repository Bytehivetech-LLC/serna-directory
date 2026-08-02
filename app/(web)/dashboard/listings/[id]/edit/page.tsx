import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOwnedListing } from "@/lib/dashboard/guards";
import { getListFormConfig } from "@/lib/list-form/queries";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { EditListingForm } from "@/components/dashboard/edit-listing-form";
import type { ListingFormInitial, ExistingImage } from "@/components/list-form/listing-form";
import type { FormValues } from "@/lib/list-form/strength";
import type { ListFormConfig } from "@/lib/list-form/types";
import type { Listing } from "@/types";

export const metadata: Metadata = { title: "Edit listing" };

const IMAGE_BUCKET = "listing-images";

/** Map a listing row back onto form field keys (the reverse of a submit). */
function listingToValues(config: ListFormConfig, listing: Listing): FormValues {
  const values: FormValues = {};
  for (const section of config.sections) {
    for (const field of section.fields) {
      const col = field.columnName;
      if (!col) continue;
      const raw = (listing as Record<string, unknown>)[col];
      if (raw == null) {
        values[field.key] = "";
      } else if (Array.isArray(raw)) {
        values[field.key] = raw.join(", ");
      } else {
        values[field.key] = String(raw);
      }
    }
  }
  return values;
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { listing } = await requireOwnedListing(id);

  const supabase = await createClient();
  const [config, settings, { data: images }, { data: tagRows }, { data: pkg }] =
    await Promise.all([
      getListFormConfig(),
      getSettings(["google_maps_browser_key"]),
      supabase
        .from("listing_images")
        .select("id, thumb_path, storage_path, sort_order")
        .eq("listing_id", listing.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listing_tags")
        .select("tags(slug)")
        .eq("listing_id", listing.id),
      listing.package_id
        ? supabase
            .from("packages")
            .select("slug, requires_approval")
            .eq("id", listing.package_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const mapsKey =
    typeof settings.google_maps_browser_key === "string"
      ? settings.google_maps_browser_key.trim() || undefined
      : undefined;

  const categorySlug =
    config.categories.find((c) => c.id === listing.category_id)?.slug ?? null;

  const tagSlugs = (tagRows ?? [])
    .map((r) => (r as { tags?: { slug?: string } | null }).tags?.slug)
    .filter((s): s is string => Boolean(s));

  const existingImages: ExistingImage[] = (images ?? []).map((img) => ({
    id: img.id,
    thumbUrl: supabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(img.thumb_path ?? img.storage_path).data.publicUrl,
  }));

  const packageSlug =
    pkg?.slug ??
    config.packages.find((p) => p.isDefault)?.slug ??
    config.packages[0]?.slug;

  const initial: ListingFormInitial = {
    categorySlug,
    values: listingToValues(config, listing),
    tagSlugs,
    packageSlug,
    showPhone: listing.show_phone ?? true,
    social:
      listing.social && typeof listing.social === "object"
        ? (listing.social as Record<string, string>)
        : {},
    geo: {
      latitude: listing.latitude,
      longitude: listing.longitude,
      google_place_id: listing.google_place_id,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/listings/${listing.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>
        <PageHeading className="mt-3" title={`Edit ${listing.business_name}`} />
      </div>

      <EditListingForm
        config={config}
        mapsKey={mapsKey}
        listingId={listing.id}
        slug={listing.slug ?? ""}
        initial={initial}
        existingImages={existingImages}
        requiresApproval={Boolean(pkg?.requires_approval)}
        isPublished={listing.status === "published"}
      />
    </div>
  );
}
