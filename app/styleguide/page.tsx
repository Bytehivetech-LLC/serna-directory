import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeading } from "@/components/layout/page-heading";
import { StyleguideContent } from "@/components/styleguide/styleguide-content";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

/**
 * Dev-only brand + component reference. Returns 404 in production so it never
 * ships to the public site.
 */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <PageContainer>
        <PageHeading
          eyebrow="Internal"
          title="Serna style guide"
          lede="Every design token and UI primitive, driven by the runtime theme. Dev-only."
        />
        <div className="mt-10">
          <StyleguideContent />
        </div>
      </PageContainer>
    </div>
  );
}
