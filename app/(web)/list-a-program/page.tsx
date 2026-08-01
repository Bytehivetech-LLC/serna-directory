import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";

export const metadata: Metadata = {
  title: "List your business",
};

export default function ListAProgramPage() {
  return (
    <PageContainer width="narrow" className="py-12">
      <PageHeading
        title="List your business"
        lede={
          <>
            Tell families what you offer.{" "}
            <b>Your listing goes live instantly with a shareable link.</b> Free
            to start, no card required.
          </>
        }
      />
      <SectionCard
        className="mt-8"
        title="The submission form is coming next"
        description="This is the scaffolded shell. The full multi-step listing form arrives in a later phase."
      >
        <p className="text-sm text-muted-foreground">
          Category picker, business details, photos, tags, and the
          Free/Featured choice will live here.
        </p>
      </SectionCard>
    </PageContainer>
  );
}
