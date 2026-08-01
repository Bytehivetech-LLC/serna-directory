import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/layout/section-card";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <PageContainer width="narrow" className="py-16">
      <SectionCard
        title="Create your account"
        description="Register to publish and manage listings."
      >
        <p className="text-sm text-muted-foreground">
          The registration form is scaffolded here and built in a later phase.
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-indigo underline underline-offset-2">
            Log in
          </Link>
          .
        </p>
      </SectionCard>
    </PageContainer>
  );
}
