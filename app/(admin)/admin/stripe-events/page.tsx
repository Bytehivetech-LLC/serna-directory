import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getStuckStripeEvents } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = { title: "Stripe events" };

/**
 * The failed / stuck stripe_events (Blocker 1). A row here means a paid event
 * threw during processing, or has been "processing" for over 15 minutes (a
 * previous attempt likely died mid-flight). Stripe keeps retrying failed events;
 * ones abandoned after 5 attempts need a manual replay from the Stripe dashboard.
 */
export default async function StripeEventsPage() {
  const events = await getStuckStripeEvents();

  return (
    <div className="space-y-6">
      <PageHeading
        title="Stripe events"
        lede="Events that failed or are stuck mid-processing. Empty is good."
      />

      {events.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing stuck"
          description="Every Stripe event has processed cleanly. If a customer reports a paid listing that didn't activate, replay the event from the Stripe dashboard and it'll be reprocessed."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Event ID</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Attempts</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Last error</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">First seen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2.5 font-mono text-xs text-ink">{e.id}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.type}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        e.status === "failed"
                          ? "rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger"
                          : "rounded-full bg-warm px-2.5 py-0.5 text-xs font-semibold text-warn-ink"
                      }
                    >
                      {e.status === "failed" ? "Failed" : "Stuck"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink">{e.attempts}</td>
                  <td className="max-w-xs px-3 py-2.5 text-xs text-muted-foreground">
                    {e.last_error ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(e.processed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
