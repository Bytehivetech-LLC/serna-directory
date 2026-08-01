import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, MessageSquare, Pencil, Star } from "lucide-react";
import { requireOwnedListing } from "@/lib/dashboard/guards";
import { getListingHealth } from "@/lib/dashboard/health";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckoutStatus } from "@/components/dashboard/checkout-status";
import { UpgradeButton } from "@/components/dashboard/upgrade-button";

export const metadata: Metadata = { title: "Your listing" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  rejected: "Needs changes",
  unpublished: "Unpublished",
  archived: "Archived",
};

export default async function OwnerListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const { listing } = await requireOwnedListing(id);

  const supabase = await createClient();
  const [{ count: imageCount }, { data: currentPkg }, { data: featuredPkg }] =
    await Promise.all([
      supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listing.id),
      listing.package_id
        ? supabase
            .from("packages")
            .select("name, price_cents, interval")
            .eq("id", listing.package_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("packages")
        .select("id, name, price_cents, interval")
        .eq("allows_featured", true)
        .eq("is_active", true)
        .eq("is_public", true)
        .gt("price_cents", 0)
        .order("sort_order")
        .limit(1)
        .maybeSingle(),
    ]);

  const health = await getListingHealth(listing, imageCount ?? 0);
  const checkoutState =
    checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title={listing.business_name}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/listing/${listing.slug}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
                View
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/listings/${listing.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={listing.status === "published" ? "default" : "secondary"}>
          {STATUS_LABEL[listing.status] ?? listing.status}
        </Badge>
        {listing.is_featured ? (
          <Badge className="gap-1 bg-violet text-white hover:bg-violet">
            <Star className="h-3 w-3 fill-white" />
            Featured
          </Badge>
        ) : null}
        <Link
          href={`/dashboard/listings/${listing.id}/inquiries`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:underline"
        >
          <MessageSquare className="h-3.5 w-3.5" /> {listing.inquiry_count ?? 0}{" "}
          inquiries
        </Link>
      </div>

      {checkoutState ? (
        <CheckoutStatus
          listingId={listing.id}
          state={checkoutState}
          initialFeatured={Boolean(listing.is_featured)}
        />
      ) : null}

      {/* Listing health — what drives owners to improve. */}
      <SectionCard title="Listing health">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-[#edecf7]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo to-violet"
                style={{ width: `${health.percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-ink">
                {health.percent}% complete.
              </span>{" "}
              {health.suggestion ??
                "This listing is looking great — families will love it."}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/listings/${listing.id}/edit`}>Improve</Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Plan">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">
              {currentPkg?.name ?? "Free listing"}
            </p>
            {currentPkg && currentPkg.price_cents > 0 ? (
              <p className="text-sm text-muted-foreground">
                {formatCurrency(currentPkg.price_cents, { fromCents: true })} /{" "}
                {currentPkg.interval}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Free plan</p>
            )}
          </div>

          {!listing.is_featured && featuredPkg ? (
            <UpgradeButton listingId={listing.id} packageId={featuredPkg.id}>
              Upgrade to {featuredPkg.name} —{" "}
              {formatCurrency(featuredPkg.price_cents, { fromCents: true })}/
              {featuredPkg.interval}
            </UpgradeButton>
          ) : listing.is_featured ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">Manage billing</Link>
            </Button>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
