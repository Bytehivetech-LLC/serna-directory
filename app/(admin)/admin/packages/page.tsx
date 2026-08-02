import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Package as PackageIcon } from "lucide-react";
import { getPackagesWithCounts } from "@/lib/admin/packages-queries";
import { getStripeStatus } from "@/lib/stripe/status";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StripeStatusBanner } from "@/components/admin/stripe-status-banner";
import { PackagesList } from "@/components/admin/packages-list";

export const metadata: Metadata = { title: "Packages" };

export default async function AdminPackagesPage() {
  const [packages, status] = await Promise.all([
    getPackagesWithCounts(),
    getStripeStatus(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Packages"
        lede="Pricing tiers. Reorder by dragging or the arrows — order is how they appear on the pricing cards."
        actions={
          <Button asChild>
            <Link href="/admin/packages/new">
              <Plus className="h-4 w-4" /> New package
            </Link>
          </Button>
        }
      />

      <StripeStatusBanner status={status} />

      {packages.length ? (
        <PackagesList packages={packages} />
      ) : (
        <EmptyState
          icon={PackageIcon}
          title="No packages yet"
          description="Create your first pricing tier — free or paid."
          action={
            <Button asChild>
              <Link href="/admin/packages/new">Create a package</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
