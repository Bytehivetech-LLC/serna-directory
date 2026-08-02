import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Pencil } from "lucide-react";
import { getNextPendingReview, type ReviewItem } from "@/lib/admin/listing-queries";
import { reportError } from "@/lib/observability/report";
import { getSettings } from "@/lib/settings";
import { formatRelative } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ListingView } from "@/components/listing/listing-view";
import { ReviewActionBar } from "@/components/admin/review-action-bar";

export const metadata: Metadata = { title: "Review queue" };

const WEB = siteUrl();

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const skipRaw = Array.isArray(sp.skip) ? sp.skip[0] : sp.skip;
  const skipIds = (skipRaw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

  // A half-complete listing, a transient DB blip, or a missing relation must
  // not take down the whole queue with a bare 500. Catch, log, and render a
  // clear recoverable error state instead. (The route also has error.tsx as a
  // backstop for anything that throws during render.)
  let item: ReviewItem | null = null;
  let loadError = false;
  try {
    item = await getNextPendingReview(skipIds);
  } catch (error) {
    loadError = true;
    reportError(error, { where: "review-queue", skipIds });
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeading title="Review queue" />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the next listing"
          description="Something went wrong fetching the review queue. This is usually a temporary hiccup — try again, and if it keeps happening, open the listing from the full list instead."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/admin/listings/review">Try again</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/listings?status=pending_review">All pending</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const settings = await getSettings(["google_maps_browser_key", "support_email"]);
  const mapsKey =
    typeof settings.google_maps_browser_key === "string"
      ? settings.google_maps_browser_key.trim() || undefined
      : undefined;
  const supportEmail =
    typeof settings.support_email === "string" && settings.support_email
      ? settings.support_email
      : "Info@SernaEducationalServices.com";

  if (!item) {
    return (
      <div className="space-y-6">
        <PageHeading title="Review queue" />
        <EmptyState
          icon={CheckCircle2}
          title={skipIds.length ? "Nothing left to review" : "The queue is clear"}
          description={
            skipIds.length
              ? "You've been through everything pending. Skipped items will return next time."
              : "No listings are waiting for review right now. Nice work."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {skipIds.length ? (
                <Button asChild variant="outline">
                  <Link href="/admin/listings/review">Start over</Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/admin/listings">All listings</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const { detail, remaining, submittedAt } = item;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageHeading title="Review queue" />
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {submittedAt ? formatRelative(submittedAt) : "recently"} · press{" "}
            <b className="text-ink">A</b> approve, <b className="text-ink">R</b> reject,{" "}
            <b className="text-ink">S</b> skip.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/listings/${detail.id}`}>
              <Pencil className="h-4 w-4" /> Full editor
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`${WEB}/listing/${detail.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open public
            </a>
          </Button>
        </div>
      </div>

      {/* Rendered exactly as the public page will look. */}
      <div className="rounded-2xl border border-border bg-bg p-4 sm:p-6">
        <ListingView
          listing={detail}
          mapsKey={mapsKey}
          supportEmail={supportEmail}
          shareUrl={`${WEB}/listing/${detail.slug}`}
          preview
        />
      </div>

      <ReviewActionBar
        listingId={detail.id}
        businessName={detail.businessName}
        skipIds={skipIds}
        remaining={remaining}
      />
    </div>
  );
}
