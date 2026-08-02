import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { getEmailTemplates } from "@/lib/admin/email-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/components/admin/email/email-list";

export const metadata: Metadata = { title: "Emails" };

export default async function EmailsPage() {
  const templates = await getEmailTemplates();
  return (
    <div className="space-y-6">
      <PageHeading
        title="Emails"
        lede="Every message the system sends. Edit the words; the layout stays on-brand."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/emails/log">
              <ScrollText className="h-4 w-4" /> Send log
            </Link>
          </Button>
        }
      />
      <EmailList templates={templates} />
    </div>
  );
}
