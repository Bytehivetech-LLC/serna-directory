import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, Receipt } from "lucide-react";
import {
  getRevenueSummary,
  getPaymentsPage,
  getActiveSubscriptions,
  type PaymentsQuery,
} from "@/lib/admin/payments-queries";
import { getStripeStatus } from "@/lib/stripe/status";
import { stripeLink } from "@/lib/stripe/dashboard-links";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StripeStatusBanner } from "@/components/admin/stripe-status-banner";

export const metadata: Metadata = { title: "Payments" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function paidVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "paid" || status === "succeeded") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = one(sp.status) || undefined;
  const from = one(sp.from) || undefined;
  const to = one(sp.to) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const query: PaymentsQuery = { status, from, to, page, pageSize: 25 };

  const [summary, result, subs, stripeStatus] = await Promise.all([
    getRevenueSummary(),
    getPaymentsPage(query),
    getActiveSubscriptions(),
    getStripeStatus(),
  ]);
  const mode = stripeStatus.mode;

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const pageHref = (p: number) => {
    const n = new URLSearchParams(params);
    n.set("page", String(p));
    return `/admin/payments?${n.toString()}`;
  };
  const exportHref = `/admin/payments/export?${params.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Payments"
        lede="Read-only. Refunds happen in Stripe."
        actions={
          <Button asChild variant="outline">
            <a href={exportHref}>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
        }
      />

      <StripeStatusBanner status={stripeStatus} />

      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="This month" value={formatCurrency(summary.thisMonthCents, { fromCents: true })} />
        <Stat label="Last month" value={formatCurrency(summary.lastMonthCents, { fromCents: true })} />
        <Stat label="MRR" value={formatCurrency(summary.mrrCents, { fromCents: true })} />
        <Stat label="Active subs" value={String(summary.activeSubscriptions)} />
        <Stat label="Churn (mo)" value={String(summary.churnThisMonth)} />
      </div>

      {/* Filters */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
          >
            <option value="">Any</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          From
          <Input type="date" name="from" defaultValue={from ?? ""} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          To
          <Input type="date" name="to" defaultValue={to ?? ""} />
        </label>
        <Button type="submit">Apply</Button>
        <Button asChild variant="ghost">
          <Link href="/admin/payments">Reset</Link>
        </Button>
      </form>

      {/* Payments table */}
      {result.rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">User</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Listing</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Amount</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((p) => {
                const stripeId = p.stripe_payment_intent_id ?? p.stripe_invoice_id;
                const kind = p.stripe_payment_intent_id ? "payments" : "invoices";
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-ink">{p.user_email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {p.listing_id ? (
                        <Link
                          href={`/admin/listings/${p.listing_id}`}
                          className="text-indigo hover:underline"
                        >
                          {p.listing_name ?? "Listing"}
                        </Link>
                      ) : (
                        p.listing_name ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-ink">
                      {formatCurrency(p.amount_cents, { fromCents: true })}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={paidVariant(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {stripeId ? (
                        <a
                          href={stripeLink(mode, kind, stripeId)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo hover:underline"
                        >
                          {p.status === "paid" ? "Refund" : "View"}{" "}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No payments match"
          description="Adjust the filters, or check back once a checkout completes."
        />
      )}

      {/* Pagination */}
      {result.rows.length ? (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            {result.total} payment{result.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            {result.page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(result.page - 1)}>Previous</Link>
              </Button>
            )}
            {result.page >= result.pageCount ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(result.page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Subscriptions */}
      <SectionCard title={`Subscriptions (${subs.length})`}>
        {subs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-semibold text-muted-foreground">User</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Package</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Renews</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-ink">{s.user_email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.package_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={s.status === "past_due" ? "destructive" : "secondary"}>
                        {s.status}
                        {s.cancel_at_period_end ? " · ending" : ""}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.current_period_end ? formatDate(s.current_period_end) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {s.stripe_subscription_id ? (
                        <a
                          href={stripeLink(mode, "subscriptions", s.stripe_subscription_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo hover:underline"
                        >
                          Manage <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active subscriptions.</p>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold text-ink">{value}</div>
    </div>
  );
}
