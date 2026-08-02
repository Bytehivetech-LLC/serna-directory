import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getPackage } from "@/lib/admin/packages-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { PackageForm } from "@/components/admin/package-form";

export const metadata: Metadata = { title: "Edit package" };

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const pkg = await getPackage(id);
  if (!pkg) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/packages"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to packages
        </Link>
        <PageHeading className="mt-3" title={`Edit ${pkg.name}`} />
      </div>
      <PackageForm mode="edit" pkg={pkg} />
    </div>
  );
}
