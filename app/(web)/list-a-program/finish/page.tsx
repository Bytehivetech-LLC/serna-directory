import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { PageContainer } from "@/components/layout/page-container";
import { ClaimDraft } from "@/components/list-form/claim-draft";

export const metadata: Metadata = { title: "Finish your listing" };

export default async function FinishPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft } = await searchParams;
  await requireUser(
    `/list-a-program/finish${draft ? `?draft=${draft}` : ""}`,
  );
  if (!draft) redirect("/dashboard");

  return (
    <PageContainer width="narrow" className="py-16">
      <ClaimDraft draftId={draft} />
    </PageContainer>
  );
}
