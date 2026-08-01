import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";

type ListingPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ListingPage({ params }: ListingPageProps) {
  const { slug } = await params;

  return (
    <PageContainer className="py-12">
      <PageHeading
        title="Listing detail"
        lede="The public listing page is scaffolded here and built in a later phase."
      />
      <SectionCard className="mt-8" title="Route parameter">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>slug:</span>
          <Badge variant="secondary" className="font-mono">
            {slug}
          </Badge>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
