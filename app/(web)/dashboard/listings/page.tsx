import type { Metadata } from "next";
import Link from "next/link";
import { Eye, LayoutList, MessageSquare, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getOwnerListings } from "@/lib/dashboard/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingRowActions } from "@/components/dashboard/listing-row-actions";

export const metadata: Metadata = { title: "Listings" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  rejected: "Needs changes",
  unpublished: "Unpublished",
  archived: "Archived",
};

export default async function ListingsPage() {
  const user = await requireUser();
  const listings = await getOwnerListings(user.id);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Listings"
        lede="Manage, edit, and track your listings."
        actions={
          <Button asChild>
            <Link href="/dashboard/listings/new">Add a listing</Link>
          </Button>
        }
      />

      {listings.length > 0 ? (
        <div className="space-y-3">
          {listings.map((l) => (
            <SectionCard key={l.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/listings/${l.id}`}
                      className="font-display text-base font-bold text-ink no-underline hover:text-indigo"
                    >
                      {l.business_name}
                    </Link>
                    {l.is_featured ? (
                      <Badge className="gap-1 bg-violet text-white hover:bg-violet">
                        <Star className="h-3 w-3 fill-white" />
                        Featured
                      </Badge>
                    ) : null}
                    <Badge
                      variant={l.status === "published" ? "default" : "secondary"}
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{l.completeness ?? 0}% complete</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {l.view_count ?? 0}
                    </span>
                    <Link
                      href={`/dashboard/listings/${l.id}/inquiries`}
                      className="inline-flex items-center gap-1 font-semibold text-indigo hover:underline"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> {l.inquiry_count ?? 0}{" "}
                      inquiries
                    </Link>
                  </div>
                </div>
                <ListingRowActions
                  listingId={l.id}
                  slug={l.slug ?? ""}
                  businessName={l.business_name}
                  status={l.status}
                />
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={LayoutList}
          title="No listings yet"
          description="Create your first listing to appear in the directory."
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Create a listing</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
