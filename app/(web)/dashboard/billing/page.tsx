import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BillingPortalButton } from "@/components/dashboard/billing-portal-button";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: subscription }, { data: payments }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, package_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, amount_cents, currency, status, description, receipt_url, paid_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const { data: pkg } = subscription?.package_id
    ? await supabase
        .from("packages")
        .select("name, price_cents, interval")
        .eq("id", subscription.package_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Billing"
        lede="Your plan, renewal, and payment history."
      />

      <SectionCard title="Your plan">
        {subscription ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-lg font-bold text-ink">
                  {pkg?.name ?? "Featured"}
                </p>
                <Badge
                  className={
                    subscription.status === "past_due"
                      ? "bg-danger text-white hover:bg-danger"
                      : "bg-good text-white hover:bg-good"
                  }
                >
                  {subscription.status === "past_due" ? "Past due" : "Active"}
                </Badge>
              </div>
              {subscription.current_period_end ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end ? "Ends" : "Renews"} on{" "}
                  {formatDate(subscription.current_period_end)}
                  {pkg?.price_cents
                    ? ` · ${formatCurrency(pkg.price_cents, { fromCents: true })}/${pkg.interval}`
                    : ""}
                </p>
              ) : null}
            </div>
            <BillingPortalButton />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-bold text-ink">
                Free plan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade a listing to Featured for top placement and more.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard">Choose a listing to upgrade</Link>
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Payment history">
        {payments && payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paid_at ?? p.created_at)}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(p.amount_cents, { fromCents: true })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.status === "refunded" ? "outline" : "secondary"}
                      className="capitalize"
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-indigo hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-sm text-faint">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="When you upgrade a listing to Featured, your invoices will appear here."
          />
        )}
      </SectionCard>
    </div>
  );
}
