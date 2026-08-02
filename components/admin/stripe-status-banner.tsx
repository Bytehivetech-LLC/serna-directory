import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { formatRelative } from "@/lib/utils/format";
import type { StripeStatus } from "@/lib/stripe/status";

/** Connection status strip for the Stripe admin pages. */
export function StripeStatusBanner({ status }: { status: StripeStatus }) {
  if (!status.configured) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warm-border bg-warm px-5 py-3.5 text-sm text-warn-ink">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <b className="text-warn-strong">Stripe isn&apos;t configured.</b> Set{" "}
          <code>STRIPE_SECRET_KEY</code> to create products and prices from here.
        </span>
      </div>
    );
  }

  const webhookOk = status.webhook.healthy;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm">
      <span className="flex items-center gap-2">
        <span
          className={
            status.mode === "live"
              ? "inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-good"
              : "inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-violet"
          }
        >
          <Circle className="h-2 w-2 fill-current" /> {status.mode} mode
        </span>
      </span>

      <span className="text-muted-foreground">
        Account:{" "}
        <span className="font-semibold text-ink">
          {status.accountName ?? "Connected"}
        </span>
      </span>

      <span className="flex items-center gap-1.5">
        {webhookOk ? (
          <CheckCircle2 className="h-4 w-4 text-good" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 text-warn-icon" aria-hidden />
        )}
        <span className="text-muted-foreground">
          Webhook:{" "}
          {status.webhook.lastEventAt ? (
            <span className={webhookOk ? "text-ink" : "text-warn-ink"}>
              last event {formatRelative(status.webhook.lastEventAt)}
              {status.webhook.lastEventType ? ` (${status.webhook.lastEventType})` : ""}
            </span>
          ) : (
            <span className="text-warn-ink">no events received yet</span>
          )}
        </span>
      </span>
    </div>
  );
}
