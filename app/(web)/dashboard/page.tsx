import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CreditCard,
  Eye,
  LayoutList,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getOwnerOverview } from "@/lib/dashboard/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warm-border bg-warm px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b8791e]" />
        <div>
          <p className="text-sm font-semibold text-[#5c430f]">{title}</p>
          <p className="text-sm text-[#7a5a1e]">{description}</p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  const overview = await getOwnerOverview(user.id);
  const { actions } = overview;
  const hasActions =
    actions.rejected.length > 0 ||
    actions.paymentPastDue ||
    actions.incompleteProfile;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Overview"
        lede="Your listings at a glance."
        actions={
          <Button asChild>
            <Link href="/dashboard/listings/new">Add a listing</Link>
          </Button>
        }
      />

      {hasActions ? (
        <div className="space-y-2.5">
          {actions.incompleteProfile ? (
            <ActionCard
              title="Finish your profile"
              description="Add your details so families and our team can reach you."
              href="/dashboard/profile"
              cta="Complete profile"
            />
          ) : null}
          {actions.paymentPastDue ? (
            <ActionCard
              title="Payment needs attention"
              description="A payment didn't go through. Update your card to stay Featured."
              href="/dashboard/billing"
              cta="Update billing"
            />
          ) : null}
          {actions.rejected.map((l) => (
            <ActionCard
              key={l.id}
              title={`Changes needed: ${l.business_name}`}
              description={l.rejection_reason ?? "Our team asked for a few edits before it can go live."}
              href={`/dashboard/listings/${l.id}/edit`}
              cta="Edit listing"
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon={LayoutList}
          label="Listings"
          value={`${overview.listingCount} / ${overview.listingLimit}`}
        />
        <Stat icon={Eye} label="Views (all time)" value={String(overview.totalViews)} />
        <Stat
          icon={MessageSquare}
          label="Inquiries this month"
          value={String(overview.inquiriesThisMonth)}
        />
      </div>

      <SectionCard
        title="Your listings"
        actions={
          overview.listings.length > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/listings">Manage all</Link>
            </Button>
          ) : null
        }
      >
        {overview.listings.length > 0 ? (
          <div className="space-y-2">
            {overview.listings.slice(0, 5).map((l) => (
              <Link
                key={l.id}
                href={`/dashboard/listings/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5 no-underline transition-colors hover:border-violet"
              >
                <span className="font-semibold text-ink">{l.business_name}</span>
                <span className="text-xs text-muted-foreground">
                  {l.completeness ?? 0}% complete · {l.view_count ?? 0} views
                </span>
              </Link>
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
      </SectionCard>
    </div>
  );
}
