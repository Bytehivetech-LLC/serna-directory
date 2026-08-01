import type { Metadata } from "next";
import Link from "next/link";
import { LayoutList } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "My listings" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeading
        title="My listings"
        lede="Manage the businesses you've listed in the directory."
      />

      {reset ? (
        <Alert>
          <AlertDescription>
            Your password has been updated. You&apos;re all set.
          </AlertDescription>
        </Alert>
      ) : null}

      <EmptyState
        icon={LayoutList}
        title="No listings yet"
        description="Once you publish a listing it will show up here with its status, views, and inquiries."
        action={
          <Button asChild>
            <Link href="/list-a-program">Create your first listing</Link>
          </Button>
        }
      />
    </div>
  );
}
