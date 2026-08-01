import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminHomePage() {
  return (
    <PageContainer className="py-12">
      <PageHeading
        title="Admin console"
        lede="Review listings, manage categories and packages, and configure the site."
      />
      <div className="mt-8">
        <EmptyState
          icon={ShieldCheck}
          title="Admin tools land in later phases"
          description="This shell confirms the admin deployment routes correctly. Listing review, taxonomy, and settings screens are built next."
        />
      </div>
    </PageContainer>
  );
}
