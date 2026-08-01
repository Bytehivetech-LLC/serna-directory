import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/layout/section-card";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <PageContainer width="narrow" className="py-16">
      <SectionCard
        title="Log in"
        description="Sign in to manage your listing."
      >
        <p className="text-sm text-muted-foreground">
          The auth form is scaffolded here and built in a later phase. Need an
          account?{" "}
          <Link href="/register" className="font-semibold text-indigo underline underline-offset-2">
            Register
          </Link>
          .
        </p>
      </SectionCard>
    </PageContainer>
  );
}
