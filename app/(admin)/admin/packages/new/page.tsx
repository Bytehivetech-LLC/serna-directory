import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeading } from "@/components/layout/page-heading";
import { PackageForm } from "@/components/admin/package-form";

export const metadata: Metadata = { title: "New package" };

export default async function NewPackagePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/packages"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to packages
        </Link>
        <PageHeading className="mt-3" title="New package" />
      </div>
      <PackageForm mode="create" />
    </div>
  );
}
