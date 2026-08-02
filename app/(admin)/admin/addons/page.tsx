import type { Metadata } from "next";
import Link from "next/link";
import { Plus, PackagePlus } from "lucide-react";
import { getAddonsWithSales } from "@/lib/admin/addons-queries";
import { getStripeStatus } from "@/lib/stripe/status";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StripeStatusBanner } from "@/components/admin/stripe-status-banner";
import { AddonsList } from "@/components/admin/addons-list";

export const metadata: Metadata = { title: "Add-ons" };

export default async function AdminAddonsPage() {
  const [addons, status] = await Promise.all([getAddonsWithSales(), getStripeStatus()]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Add-ons"
        lede="Optional extras sold alongside packages. Reorder to change how they appear in the picker."
        actions={
          <Button asChild>
            <Link href="/admin/addons/new">
              <Plus className="h-4 w-4" /> New add-on
            </Link>
          </Button>
        }
      />
      <StripeStatusBanner status={status} />
      {addons.length ? (
        <AddonsList addons={addons} />
      ) : (
        <EmptyState
          icon={PackagePlus}
          title="No add-ons yet"
          description="Create extras like a newsletter spotlight or extra photos."
          action={
            <Button asChild>
              <Link href="/admin/addons/new">Create an add-on</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
