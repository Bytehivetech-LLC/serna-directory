import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";
import { getUserDetail } from "@/lib/admin/queries";
import { getSession } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";
import { UserAdminPanel } from "@/components/admin/user-admin-panel";
import { UserProfileForm } from "@/components/admin/user-profile-form";

export const metadata: Metadata = { title: "User" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [{ profile, listings, subscriptions, payments, audit }, session] =
    await Promise.all([getUserDetail(id), getSession()]);
  if (!profile) notFound();

  const isSelf = session?.user?.id === profile.id;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <PageHeading
          className="mt-3"
          title={profile.full_name || profile.email}
          lede={profile.email}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
          {profile.role}
        </Badge>
        {profile.is_verified ? (
          <Badge className="bg-good-soft text-good hover:bg-good-soft">
            Verified
          </Badge>
        ) : null}
        {profile.is_suspended ? <Badge variant="destructive">Suspended</Badge> : null}
        {profile.deleted_at ? <Badge variant="destructive">Deleted</Badge> : null}
        <span className="text-sm text-muted-foreground">
          Joined {formatDate(profile.created_at)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Profile">
            <UserProfileForm
              userId={profile.id}
              initial={{
                full_name: profile.full_name ?? "",
                phone: profile.phone ?? "",
                business_address: profile.business_address ?? "",
                notes: profile.notes ?? "",
              }}
            />
          </SectionCard>

          <SectionCard title={`Listings (${listings.length})`}>
            {listings.length ? (
              <ul className="divide-y divide-border">
                {listings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/listings/${l.id}`}
                        className="font-semibold text-ink no-underline hover:text-indigo"
                      >
                        {l.business_name}
                      </Link>
                      <Badge
                        variant={l.status === "published" ? "default" : "secondary"}
                      >
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                      {l.is_featured ? (
                        <Badge className="bg-violet text-white hover:bg-violet">
                          Featured
                        </Badge>
                      ) : null}
                    </div>
                    {l.slug ? (
                      <Link
                        href={`/listing/${l.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-ink"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No listings.</p>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SectionCard title="Subscriptions">
              {subscriptions.length ? (
                <ul className="space-y-2.5 text-sm">
                  {subscriptions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{s.status}</Badge>
                      <span className="text-muted-foreground">
                        {s.current_period_end
                          ? `until ${formatDate(s.current_period_end)}`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No subscriptions.</p>
              )}
            </SectionCard>

            <SectionCard title="Payments">
              {payments.length ? (
                <ul className="space-y-2.5 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="text-ink">
                        {formatCurrency(p.amount_cents, { fromCents: true })}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Badge
                          variant={p.status === "failed" ? "destructive" : "secondary"}
                        >
                          {p.status}
                        </Badge>
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo hover:underline"
                          >
                            Receipt
                          </a>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No payments.</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Audit trail">
            {audit.length ? (
              <ul className="divide-y divide-border">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <span className="font-mono text-[13px] text-ink">{a.action}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        by {a.actor_email ?? "system"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-faint">
                      {formatDateTime(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
            )}
          </SectionCard>
        </div>

        {/* Actions sidebar */}
        <div className="lg:col-span-1">
          <SectionCard title="Actions" className="lg:sticky lg:top-6">
            <UserAdminPanel
              userId={profile.id}
              email={profile.email}
              role={profile.role}
              isVerified={profile.is_verified}
              isSuspended={profile.is_suspended}
              isSelf={isSelf}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
