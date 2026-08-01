import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <PageContainer className="py-14">
      <PageHeading
        eyebrow="Arizona homeschool & education"
        title="Find the right program for your family"
        lede={
          <>
            Browse tutors, co-ops, micro-schools, and enrichment across Arizona —{" "}
            <b>filter by city, ages, subjects, and ESA acceptance</b>.
          </>
        }
        actions={
          <Button asChild size="lg">
            <Link href="/list-a-program">List your business</Link>
          </Button>
        }
      />

      <div className="mt-10">
        <EmptyState
          icon={Search}
          title="The directory is being built"
          description="Listings will appear here as businesses join. Are you a provider? Get your listing live today — it's free to start."
          action={
            <Button asChild>
              <Link href="/list-a-program">
                <Sparkles className="h-4 w-4" />
                List your business
              </Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
