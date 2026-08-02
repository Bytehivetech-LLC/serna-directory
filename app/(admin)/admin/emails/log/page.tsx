import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEmailLogPage, type EmailLogQuery } from "@/lib/admin/email-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Email log" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "sent") return "default";
  if (s === "failed") return "destructive";
  return "secondary";
}

export default async function EmailLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query: EmailLogQuery = {
    template: one(sp.template) || undefined,
    status: one(sp.status) || undefined,
    recipient: one(sp.recipient) || undefined,
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  const result = await getEmailLogPage(query);

  const params = new URLSearchParams();
  if (query.template) params.set("template", query.template);
  if (query.status) params.set("status", query.status);
  if (query.recipient) params.set("recipient", query.recipient);
  const pageHref = (p: number) => { const n = new URLSearchParams(params); n.set("page", String(p)); return `/admin/emails/log?${n.toString()}`; };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/emails" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to emails
        </Link>
        <PageHeading className="mt-3" title="Send log" lede="Every send, with the provider error on failures." />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Template
          <Input name="template" defaultValue={query.template ?? ""} placeholder="listing_approved" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Status
          <select name="status" defaultValue={query.status ?? ""} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-ink">
            <option value="">Any</option>
            <option value="sent">Sent</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Recipient
          <Input name="recipient" defaultValue={query.recipient ?? ""} placeholder="name@example.com" />
        </label>
        <Button type="submit">Filter</Button>
        <Button asChild variant="ghost"><Link href="/admin/emails/log">Reset</Link></Button>
      </form>

      {result.rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">When</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Template</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Recipient</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Detail</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink">{r.template_key ?? "—"}</td>
                  <td className="px-3 py-2.5 text-ink">{r.to_email}</td>
                  <td className="px-3 py-2.5"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.error_message ?? r.provider_id ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Mail} title="No sends match" description="Adjust the filters, or check back after an email fires." />
      )}

      {result.rows.length ? (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{result.total} sends</span>
          <div className="flex gap-2">
            {result.page <= 1 ? <Button variant="outline" size="sm" disabled>Previous</Button> : <Button asChild variant="outline" size="sm"><Link href={pageHref(result.page - 1)}>Previous</Link></Button>}
            {result.page >= result.pageCount ? <Button variant="outline" size="sm" disabled>Next</Button> : <Button asChild variant="outline" size="sm"><Link href={pageHref(result.page + 1)}>Next</Link></Button>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
