import type { Metadata } from "next";
import Link from "next/link";
import { LayoutList, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionCard } from "@/components/layout/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "My listings" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  rejected: "Needs changes",
  unpublished: "Unpublished",
  archived: "Archived",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, business_name, status, is_featured, city")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeading
        title="My listings"
        lede="Manage the businesses you've listed in the directory."
        actions={
          <Button asChild>
            <Link href="/list-a-program">Add a listing</Link>
          </Button>
        }
      />

      {reset ? (
        <Alert>
          <AlertDescription>
            Your password has been updated. You&apos;re all set.
          </AlertDescription>
        </Alert>
      ) : null}

      {listings && listings.length > 0 ? (
        <div className="space-y-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/listings/${l.id}`}
              className="block no-underline"
            >
              <SectionCard className="transition-colors hover:border-violet">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-bold text-ink">
                      {l.business_name}
                    </p>
                    {l.city ? (
                      <p className="text-sm text-muted-foreground">{l.city}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
              </SectionCard>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={LayoutList}
          title="No listings yet"
          description="Once you publish a listing it will show up here with its status, views, and inquiries."
          action={
            <Button asChild>
              <Link href="/list-a-program">Create your first listing</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
