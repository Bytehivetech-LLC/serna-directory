import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getFulfilmentQueue } from "@/lib/admin/fulfilment-queries";
import { getStripeStatus } from "@/lib/stripe/status";
import { stripeDashboardBase } from "@/lib/stripe/dashboard-links";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { FulfilmentRow } from "@/components/admin/fulfilment-row";

export const metadata: Metadata = { title: "Fulfilment" };

export default async function FulfilmentPage() {
  const [items, status] = await Promise.all([getFulfilmentQueue(), getStripeStatus()]);
  const stripeBase = stripeDashboardBase(status.mode);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Fulfilment"
        lede="Manual add-ons that need a human. Oldest first — anything past 7 days is flagged."
      />

      {items.length ? (
        <div className="space-y-4">
          {items.map((item) => (
            <FulfilmentRow key={item.id} item={item} stripeBase={stripeBase} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to fulfil"
          description="When someone buys a manual add-on like a newsletter spotlight, it shows up here."
        />
      )}
    </div>
  );
}
