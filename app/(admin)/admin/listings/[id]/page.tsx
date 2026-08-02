import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import {
  getAdminListingDetail,
  getListingAudit,
  getListingLookups,
} from "@/lib/admin/listing-queries";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListingEditor } from "@/components/admin/admin-listing-editor";

export const metadata: Metadata = { title: "Edit listing" };

const WEB = siteUrl();

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

function summariseDiff(diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  if (typeof d.reason === "string") return d.reason;
  if (typeof d.note === "string") return d.note;
  const changed = d.changed as Record<string, unknown> | undefined;
  if (changed && typeof changed === "object") {
    const keys = Object.keys(changed);
    if (keys.length) return `changed: ${keys.join(", ")}`;
  }
  return null;
}

export default async function AdminListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [data, lookups, audit] = await Promise.all([
    getAdminListingDetail(id),
    getListingLookups(),
    getListingAudit(id),
  ]);
  if (!data) notFound();

  const { listing, ownerEmail, images } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/listings"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>
        <PageHeading
          className="mt-3"
          title={listing.business_name}
          actions={
            <Button asChild variant="outline">
              <a href={`${WEB}/listing/${listing.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open public
              </a>
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={listing.status === "published" ? "default" : "secondary"}>
            {STATUS_LABEL[listing.status] ?? listing.status}
          </Badge>
          {listing.is_featured ? (
            <Badge className="gap-1 bg-violet text-white hover:bg-violet">
              <Star className="h-3 w-3 fill-white" /> Featured
            </Badge>
          ) : null}
          {listing.deleted_at ? <Badge variant="destructive">Deleted</Badge> : null}
          {listing.rejection_reason ? (
            <span className="text-sm text-muted-foreground">
              Last note: {listing.rejection_reason}
            </span>
          ) : null}
        </div>
      </div>

      <AdminListingEditor
        listing={listing}
        ownerEmail={ownerEmail}
        images={images}
        categories={lookups.categories}
        packages={lookups.packages}
      />

      <SectionCard title="History">
        {audit.length ? (
          <ul className="divide-y divide-border">
            {audit.map((a) => {
              const summary = summariseDiff(a.diff);
              return (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <span className="font-mono text-[13px] text-ink">{a.action}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      by {a.actor_email ?? "system"}
                    </span>
                    {summary ? (
                      <span className="ml-2 text-sm text-faint">— {summary}</span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-faint">
                    {formatDateTime(a.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
