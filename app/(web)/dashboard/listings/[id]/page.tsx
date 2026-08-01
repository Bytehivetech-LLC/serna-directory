import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Star } from "lucide-react";
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
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, business_name, slug, status, is_featured, package_id")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  const [{ data: currentPkg }, { data: featuredPkg }] = await Promise.all([
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

  const checkoutState =
    checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title={listing.business_name}
        actions={
          <Button asChild variant="outline">
            <Link href={`/listing/${listing.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              View public page
            </Link>
          </Button>
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
      </div>

      {checkoutState ? (
        <CheckoutStatus
          listingId={listing.id}
          state={checkoutState}
          initialFeatured={Boolean(listing.is_featured)}
        />
      ) : null}

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
