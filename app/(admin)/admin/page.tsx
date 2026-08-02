import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck } from "lucide-react";
import { getAdminDashboard } from "@/lib/admin/queries";
import { getStoragePanel, formatBytes } from "@/lib/admin/storage-queries";
import { formatCurrency, formatRelative } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";

export const metadata: Metadata = { title: "Admin dashboard" };

const STATUS_LABEL: Record<string, string> = {
  published: "Live",
  pending_review: "Pending review",
  draft: "Draft",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

function AuditVerb({ action }: { action: string }) {
  return <span className="font-mono text-[13px] text-ink">{action}</span>;
}

export default async function AdminDashboardPage() {
  const [data, storage] = await Promise.all([getAdminDashboard(), getStoragePanel()]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dashboard"
        lede="What needs attention across the directory."
      />

      {/* The number that matters — straight to the review queue. */}
      <Link
        href="/admin/listings?status=pending_review"
        className="flex items-center justify-between gap-4 rounded-2xl border border-violet/30 bg-violet-soft px-6 py-5 no-underline transition-colors hover:border-violet"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet text-white">
            <ClipboardCheck className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <div className="font-display text-3xl font-extrabold leading-none text-ink">
              {data.pendingReview}
            </div>
            <div className="mt-1 text-sm font-semibold text-indigo-deep">
              listing{data.pendingReview === 1 ? "" : "s"} awaiting review
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-violet">
          Open queue <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="New users this week" value={String(data.newUsersThisWeek)} />
        <Stat
          label="Revenue this month"
          value={formatCurrency(data.revenueThisMonthCents, { fromCents: true })}
        />
        <Stat
          label="Live listings"
          value={String(data.statusCounts.published)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Listings by status */}
        <SectionCard title="Listings by status">
          <ul className="divide-y divide-border">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <li
                key={status}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-muted-foreground">
                  {STATUS_LABEL[status] ?? status}
                </span>
                <span className="font-semibold text-ink">{count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Recent audit */}
        <SectionCard
          title="Recent activity"
          actions={
            <Link
              href="/admin/audit"
              className="text-sm font-semibold text-indigo hover:underline"
            >
              View all
            </Link>
          }
        >
          {data.recentAudit.length ? (
            <ul className="divide-y divide-border">
              {data.recentAudit.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <AuditVerb action={e.action} />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {e.actor_email ?? "system"}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-faint">
                    {formatRelative(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Storage lifecycle */}
      <SectionCard title="Storage">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Image storage</div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink">{formatBytes(storage.totalBytes)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pending deletions</div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink">{storage.pending}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Failed deletions</div>
            <div className={`mt-1 font-display text-xl font-extrabold ${storage.failed > 0 ? "text-danger" : "text-ink"}`}>{storage.failed}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last sweep</div>
            <div className="mt-1 text-sm font-semibold text-ink">{storage.lastSweep ? formatRelative(storage.lastSweep) : "never"}</div>
          </div>
        </div>
      </SectionCard>

      {/* Stuck/failed Stripe events — a paid event that never finished processing. */}
      {data.stuckStripeEvents > 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm text-ink">
            <b>
              {data.stuckStripeEvents} Stripe event
              {data.stuckStripeEvents === 1 ? "" : "s"} failed or stuck.
            </b>{" "}
            A paid event may not have activated a listing.{" "}
            <Link href="/admin/stripe-events" className="font-semibold text-indigo hover:underline">
              Review events
            </Link>
          </p>
        </div>
      ) : null}

      {/* Stripe webhook failures — a hard signal something isn't being processed. */}
      {data.webhookFailures > 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm text-ink">
            <b>
              {data.webhookFailures} Stripe webhook{" "}
              {data.webhookFailures === 1 ? "failure" : "failures"} this week.
            </b>{" "}
            Events failed to process and Stripe is retrying.{" "}
            <Link href="/admin/audit" className="font-semibold text-indigo hover:underline">
              See the audit log
            </Link>
          </p>
        </div>
      ) : null}

      {/* Billing problems — only when there are any. */}
      {data.billing.failedPayments > 0 || data.billing.pastDueSubs > 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-warm-border bg-warm px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn-icon" aria-hidden />
          <p className="text-sm text-warn-ink">
            <b className="text-warn-strong">Billing needs attention:</b>{" "}
            {data.billing.failedPayments > 0
              ? `${data.billing.failedPayments} failed payment${data.billing.failedPayments === 1 ? "" : "s"}`
              : null}
            {data.billing.failedPayments > 0 && data.billing.pastDueSubs > 0
              ? " · "
              : null}
            {data.billing.pastDueSubs > 0
              ? `${data.billing.pastDueSubs} past-due subscription${data.billing.pastDueSubs === 1 ? "" : "s"}`
              : null}
            .{" "}
            <Link href="/admin/payments" className="font-semibold text-indigo hover:underline">
              Review payments
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold text-ink">
        {value}
      </div>
    </div>
  );
}
