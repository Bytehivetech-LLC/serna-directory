import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { getListingLookups } from "@/lib/admin/listing-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { AddonForm } from "@/components/admin/addon-form";

export const metadata: Metadata = { title: "New add-on" };

export default async function NewAddonPage() {
  await requireAdmin();
  const { packages } = await getListingLookups();
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/addons"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to add-ons
        </Link>
        <PageHeading className="mt-3" title="New add-on" />
      </div>
      <AddonForm mode="create" packages={packages} />
    </div>
  );
}
