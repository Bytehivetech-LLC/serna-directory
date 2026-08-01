import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import DOMPurify from "isomorphic-dompurify";
import { Clock, ExternalLink, MapPin, Phone, Star } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
} from "@/components/listing/brand-icons";
import { getListingBySlug } from "@/lib/listing/queries";
import { getSettings } from "@/lib/settings";
import type { ListingDetail } from "@/lib/listing/types";
import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ContactForm } from "@/components/listing/contact-form";
import { ShareRow } from "@/components/listing/share-row";
import { MessageButton } from "@/components/listing/message-button";
import { ListingMap } from "@/components/listing/listing-map";
import { ViewTracker } from "@/components/listing/view-tracker";

const ESA_TEXT: Record<string, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

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
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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

function DescriptionBody({ listing }: { listing: ListingDetail }) {
  if (listing.descriptionHtml && listing.descriptionHtml.trim()) {
    const clean = DOMPurify.sanitize(listing.descriptionHtml, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });
    return (
      <div
        className="space-y-3 text-[15px] leading-relaxed text-ink [&_a]:text-indigo [&_a]:underline [&_li]:ml-4 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  if (listing.description && listing.description.trim()) {
    const paragraphs = listing.description
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    return (
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="whitespace-pre-line text-[15px] leading-relaxed text-ink"
          >
            {p}
          </p>
        ))}
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">No description yet.</p>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm font-semibold text-muted-foreground sm:w-40 sm:shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function TagChips({ tags }: { tags: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span
          key={t.id}
          className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground"
        >
          {t.name}
        </span>
      ))}
    </div>
  );
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
  const location = [listing.city, listing.state].filter(Boolean).join(", ");

  const hasDetails =
    Boolean(listing.agesServed) ||
    Boolean(listing.rateText) ||
    Boolean(listing.acceptsEsa) ||
    listing.alsoServes.length > 0;

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

      <ListingGallery
        images={listing.images}
        businessName={listing.businessName}
      />

      <div className="mt-8 grid grid-cols-1 gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
        {/* MAIN */}
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {listing.categoryName ? (
                <Badge variant="secondary">{listing.categoryName}</Badge>
              ) : null}
              {listing.isFeatured ? (
                <Badge className="gap-1 bg-violet text-white hover:bg-violet">
                  <Star className="h-3 w-3 fill-white" />
                  Featured
                </Badge>
              ) : null}
              {listing.status === "pending_review" ? (
                <Badge className="gap-1 bg-warm text-[#7a5a1e] hover:bg-warm">
                  <Clock className="h-3 w-3" />
                  Pending review
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.015em] text-ink sm:text-4xl">
              {listing.businessName}
            </h1>
            {location ? (
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
                {location}
              </p>
            ) : null}
          </div>

          <SectionCard title="About">
            <DescriptionBody listing={listing} />
          </SectionCard>

          {hasDetails ? (
            <SectionCard title="Details">
              <dl>
                {listing.agesServed ? (
                  <DetailRow label={listing.agesLabel} value={listing.agesServed} />
                ) : null}
                {listing.rateText ? (
                  <DetailRow label={listing.rateLabel} value={listing.rateText} />
                ) : null}
                {listing.acceptsEsa ? (
                  <DetailRow
                    label="Accepts Arizona ESA funds"
                    value={ESA_TEXT[listing.acceptsEsa]}
                  />
                ) : null}
                {listing.alsoServes.length > 0 ? (
                  <DetailRow
                    label="Also serves"
                    value={listing.alsoServes.join(", ")}
                  />
                ) : null}
              </dl>
            </SectionCard>
          ) : null}

          {listing.subjectGroup && listing.subjectGroup.tags.length > 0 ? (
            <SectionCard title={listing.subjectGroup.name}>
              <TagChips tags={listing.subjectGroup.tags} />
            </SectionCard>
          ) : null}

          {listing.lat != null && listing.lng != null ? (
            <SectionCard title="Location">
              <ListingMap lat={listing.lat} lng={listing.lng} apiKey={mapsKey} />
            </SectionCard>
          ) : null}

          <div id="contact-form" className="scroll-mt-6">
            <SectionCard
              title={`Contact ${listing.businessName}`}
              description="Send a message and they'll reply straight to your email."
            >
              <ContactForm
                listingId={listing.id}
                businessName={listing.businessName}
              />
            </SectionCard>
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className="min-[900px]:sticky min-[900px]:top-6 min-[900px]:h-fit min-[900px]:space-y-6 space-y-6">
          <SectionCard>
            <div className="flex flex-col gap-2.5">
              <MessageButton className="w-full" />
              {listing.website ? (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={listing.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit website
                  </a>
                </Button>
              ) : null}
              {listing.showPhone && listing.contactPhone ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={`tel:${listing.contactPhone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="h-4 w-4" />
                    {listing.contactPhone}
                  </a>
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {listing.otherGroups.length > 0 ? (
            <SectionCard title="Good to know">
              <div className="space-y-4">
                {listing.otherGroups.map((group) => (
                  <div key={group.id}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.06em] text-faint">
                      {group.name}
                    </p>
                    <TagChips tags={group.tags} />
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {(listing.social.instagram ||
            listing.social.facebook ||
            listing.social.youtube) ? (
            <SectionCard title="Follow">
              <div className="flex gap-2">
                {listing.social.instagram ? (
                  <SocialLink href={listing.social.instagram} label="Instagram">
                    <InstagramIcon className="h-4 w-4" />
                  </SocialLink>
                ) : null}
                {listing.social.facebook ? (
                  <SocialLink href={listing.social.facebook} label="Facebook">
                    <FacebookIcon className="h-4 w-4" />
                  </SocialLink>
                ) : null}
                {listing.social.youtube ? (
                  <SocialLink href={listing.social.youtube} label="YouTube">
                    <YoutubeIcon className="h-4 w-4" />
                  </SocialLink>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Share">
            <ShareRow url={shareUrl} title={listing.businessName} />
          </SectionCard>

          <div className="flex flex-col gap-1 px-1 text-sm">
            <Link
              href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Claim listing: ${listing.businessName}`)}`}
              className="text-muted-foreground hover:text-ink"
            >
              Claim this listing
            </Link>
            <Link
              href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Report a problem: ${listing.businessName}`)}`}
              className="text-muted-foreground hover:text-ink"
            >
              Report a problem
            </Link>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong text-muted-foreground transition-colors hover:border-violet hover:text-indigo"
    >
      {children}
    </a>
  );
}
