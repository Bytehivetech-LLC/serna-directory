import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Count active categories straight from the database. Used to prove the
 * Supabase wiring end-to-end (Phase 2 verification). Falls back to null on any
 * error so the page never 500s over a directory count.
 */
async function getCategoryCount(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const categoryCount = await getCategoryCount();

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

      {categoryCount !== null ? (
        <div className="mt-6">
          <Badge variant="secondary" className="text-sm">
            {categoryCount} categor{categoryCount === 1 ? "y" : "ies"} in the
            directory
          </Badge>
        </div>
      ) : null}

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
