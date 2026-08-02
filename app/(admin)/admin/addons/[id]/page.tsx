import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getAddon } from "@/lib/admin/addons-queries";
import { getListingLookups } from "@/lib/admin/listing-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { AddonForm } from "@/components/admin/addon-form";

export const metadata: Metadata = { title: "Edit add-on" };

export default async function EditAddonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [addon, { packages }] = await Promise.all([getAddon(id), getListingLookups()]);
  if (!addon) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/addons"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to add-ons
        </Link>
        <PageHeading className="mt-3" title={`Edit ${addon.name}`} />
      </div>
      <AddonForm mode="edit" addon={addon} packages={packages} />
    </div>
  );
}
