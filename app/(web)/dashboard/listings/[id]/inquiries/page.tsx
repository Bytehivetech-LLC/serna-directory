import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Phone } from "lucide-react";
import { requireOwnedListing } from "@/lib/dashboard/guards";
import { createClient } from "@/lib/supabase/server";
import { formatRelative, formatPhone, phoneHref } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkInquiriesRead } from "@/components/dashboard/mark-inquiries-read";

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { listing } = await requireOwnedListing(id);

  const supabase = await createClient();
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, name, email, phone, message, status, created_at")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <MarkInquiriesRead listingId={listing.id} />

      <div>
        <Link
          href={`/dashboard/listings/${listing.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>
        <PageHeading
          className="mt-3"
          title="Inquiries"
          lede={`Messages families sent about ${listing.business_name}.`}
        />
      </div>

      {inquiries && inquiries.length > 0 ? (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <SectionCard key={inq.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{inq.name}</p>
                    {inq.status === "new" ? (
                      <Badge className="bg-violet text-white hover:bg-violet">
                        New
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {inq.email}
                    {inq.phone ? ` · ${formatPhone(inq.phone)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-faint">
                  {formatRelative(inq.created_at)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line rounded-xl bg-bg p-3.5 text-sm text-ink">
                {inq.message}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a
                    href={`mailto:${inq.email}?subject=${encodeURIComponent(`Re: your inquiry about ${listing.business_name}`)}`}
                  >
                    <Mail className="h-4 w-4" /> Reply by email
                  </a>
                </Button>
                {inq.phone && phoneHref(inq.phone) ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={phoneHref(inq.phone)!}>
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  </Button>
                ) : null}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="No inquiries yet"
          description="When families message you through your listing, they'll show up here."
        />
      )}
    </div>
  );
}
