import DOMPurify from "isomorphic-dompurify";
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
} from "@/components/listing/brand-icons";
import type { ListingDetail } from "@/lib/listing/types";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { MessageDialog } from "@/components/listing/message-dialog";
import { ShareRow } from "@/components/listing/share-row";
import { LazyListingMap } from "@/components/listing/lazy-listing-map";

const ESA_TEXT: Record<string, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

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
  return <p className="text-sm text-muted-foreground">No description yet.</p>;
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
      rel="noopener noreferrer nofollow"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong text-muted-foreground transition-colors hover:border-violet hover:text-indigo"
    >
      {children}
    </a>
  );
}

/**
 * The public listing render, shared by the live page and the admin review
 * queue. `preview` swaps the live contact/claim/report actions for a static
 * note so reviewers see the exact layout without triggering owner actions.
 */
export function ListingView({
  listing,
  mapsKey,
  supportEmail,
  shareUrl,
  preview = false,
  verifiedBadge = false,
}: {
  listing: ListingDetail;
  mapsKey?: string;
  supportEmail: string;
  shareUrl: string;
  preview?: boolean;
  /** From listing_entitlements — a bought or earned verified badge. */
  verifiedBadge?: boolean;
}) {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const hasDetails =
    Boolean(listing.agesServed) ||
    Boolean(listing.rateText) ||
    Boolean(listing.acceptsEsa) ||
    listing.alsoServes.length > 0;

  return (
    <>
      <ListingGallery images={listing.images} businessName={listing.businessName} />

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
                  <DetailRow label="Also serves" value={listing.alsoServes.join(", ")} />
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
              <LazyListingMap lat={listing.lat} lng={listing.lng} apiKey={mapsKey} />
            </SectionCard>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <aside className="min-[900px]:sticky min-[900px]:top-6 min-[900px]:h-fit min-[900px]:space-y-6 space-y-6">
          {verifiedBadge ? (
            <div className="flex items-center gap-2 rounded-xl border border-good/30 bg-good-soft px-4 py-2.5 text-sm font-semibold text-good">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Verified business
            </div>
          ) : null}
          <SectionCard>
            <div className="flex flex-col gap-2.5">
              {preview ? (
                <Button className="w-full" disabled>
                  Message {listing.businessName}
                </Button>
              ) : (
                <MessageDialog
                  listingId={listing.id}
                  businessName={listing.businessName}
                  className="w-full"
                />
              )}
              {listing.website ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={listing.website} target="_blank" rel="noopener noreferrer nofollow">
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

          {listing.social.instagram ||
          listing.social.facebook ||
          listing.social.youtube ? (
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

          {!preview ? (
            <>
              <SectionCard title="Share">
                <ShareRow url={shareUrl} title={listing.businessName} />
              </SectionCard>

              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Claim listing: ${listing.businessName}`)}`}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Claim
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Report a problem: ${listing.businessName}`)}`}
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}
