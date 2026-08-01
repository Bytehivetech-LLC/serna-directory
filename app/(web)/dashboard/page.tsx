import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <PageContainer className="py-12">
      <PageHeading
        title="Your dashboard"
        lede="Manage your listings, inquiries, and subscription."
      />
      <div className="mt-8">
        <EmptyState
          icon={LayoutDashboard}
          title="No listings yet"
          description="Once you publish a listing it will show up here with its status, views, and inquiries."
          action={
            <Button asChild>
              <Link href="/list-a-program">Create your first listing</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
