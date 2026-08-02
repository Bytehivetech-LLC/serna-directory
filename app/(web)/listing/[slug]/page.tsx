import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getListingBySlug } from "@/lib/listing/queries";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { ListingView } from "@/components/listing/listing-view";
import { ViewTracker } from "@/components/listing/view-tracker";

type Params = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return siteUrl();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Listing not found" };

  const description =
    (listing.description ?? "").replace(/\s+/g, " ").trim().slice(0, 160) ||
    `${listing.businessName} — Arizona homeschool & education directory.`;
  const cover = listing.images[0]?.url;

  return {
    title: listing.businessName,
    description,
    openGraph: {
      title: listing.businessName,
      description,
      type: "website",
      images: cover ? [{ url: cover }] : undefined,
    },
    robots: listing.status === "published" ? undefined : { index: false },
  };
}

export default async function ListingPage({ params }: Params) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const settings = await getSettings([
    "google_maps_browser_key",
    "support_email",
  ]);
  const mapsKey =
    typeof settings.google_maps_browser_key === "string"
      ? settings.google_maps_browser_key.trim() || undefined
      : undefined;
  const supportEmail =
    typeof settings.support_email === "string" && settings.support_email
      ? settings.support_email
      : "Info@SernaEducationalServices.com";

  const origin = await siteOrigin();
  const shareUrl = `${origin}/listing/${listing.slug}`;

  // Entitlements decide bought/earned perks (verified badge, etc.).
  const supabase = await createClient();
  const { data: ent } = await supabase.rpc("listing_entitlements", {
    p_listing_id: listing.id,
  });
  const entRow = Array.isArray(ent) ? ent[0] : ent;
  const verifiedBadge = Boolean(
    (entRow as { verified_badge?: boolean } | null)?.verified_badge,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.businessName,
    description: listing.description ?? undefined,
    url: shareUrl,
    image: listing.images[0]?.url,
    telephone:
      listing.showPhone && listing.contactPhone
        ? listing.contactPhone
        : undefined,
    address:
      listing.city || listing.state
        ? {
            "@type": "PostalAddress",
            addressLocality: listing.city ?? undefined,
            addressRegion: listing.state ?? undefined,
            addressCountry: "US",
          }
        : undefined,
    geo:
      listing.lat != null && listing.lng != null
        ? {
            "@type": "GeoCoordinates",
            latitude: listing.lat,
            longitude: listing.lng,
          }
        : undefined,
  };

  return (
    <PageContainer className="py-8">
      <ViewTracker listingId={listing.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ListingView
        listing={listing}
        mapsKey={mapsKey}
        supportEmail={supportEmail}
        shareUrl={shareUrl}
        verifiedBadge={verifiedBadge}
      />
    </PageContainer>
  );
}
