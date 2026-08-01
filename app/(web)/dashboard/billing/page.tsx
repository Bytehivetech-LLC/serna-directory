import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Billing"
        lede="Manage your subscription, payment method, and invoices."
      />
      <EmptyState
        icon={CreditCard}
        title="Nothing to bill yet"
        description="When you upgrade a listing to Featured, your plan and invoices will appear here."
      />
    </div>
  );
}
