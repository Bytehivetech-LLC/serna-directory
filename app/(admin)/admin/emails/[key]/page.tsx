import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import {
  getEmailTemplate,
  getTemplateVersions,
  parseVariables,
} from "@/lib/admin/email-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { EmailEditor } from "@/components/admin/email/email-editor";

export const metadata: Metadata = { title: "Edit email" };

export default async function EmailEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [template, versions] = await Promise.all([
    getEmailTemplate(key),
    getTemplateVersions(key),
  ]);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/emails" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to emails
        </Link>
        <PageHeading
          className="mt-3"
          title={template.name}
          lede={template.description ?? undefined}
        />
        {template.is_locked ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-warm-border bg-warm px-3 py-1.5 text-xs text-[#7a5a1e]">
            <Lock className="h-3.5 w-3.5" /> Locked on — you can reword it, but it cannot be turned off (it carries essential account info).
          </p>
        ) : null}
      </div>
      <EmailEditor template={template} variables={parseVariables(template.variables)} versions={versions} />
    </div>
  );
}
