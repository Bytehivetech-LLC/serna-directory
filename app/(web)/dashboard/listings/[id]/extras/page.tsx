import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireOwnedListing } from "@/lib/dashboard/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { effectLabel } from "@/lib/addons/effects";
import type { FormAddon } from "@/lib/list-form/types";
import { PageHeading } from "@/components/layout/page-heading";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";
import { BuyExtras } from "@/components/dashboard/buy-extras";

export const metadata: Metadata = { title: "Extras" };

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pending_payment: "Pending payment",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
  fulfilled: "Fulfilled",
};

export default async function ExtrasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { listing } = await requireOwnedListing(id);
  const supabase = await createClient();

  const [{ data: purchases }, { data: addonRows }] = await Promise.all([
    supabase
      .from("listing_addons")
      .select(
        "id, quantity, status, amount_cents, starts_at, expires_at, created_at, addons(name, effect)",
      )
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("addons")
      .select(
        "id, slug, name, short_description, description, price_cents, currency, interval, max_quantity, package_ids, badge_label, image_url",
      )
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order"),
  ]);

  type Row = NonNullable<typeof purchases>[number] & {
    addons: { name: string | null; effect: string | null } | null;
  };
  const rows = (purchases ?? []) as Row[];
  const active = rows.filter((r) => r.status === "active");
  const history = rows;

  const available: FormAddon[] = (addonRows ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    shortDescription: a.short_description,
    description: a.description,
    priceCents: a.price_cents ?? 0,
    currency: a.currency ?? "usd",
    interval: a.interval ?? "one_time",
    maxQuantity: a.max_quantity ?? 1,
    packageIds: Array.isArray(a.package_ids) ? a.package_ids : [],
    badgeLabel: a.badge_label,
    imageUrl: a.image_url,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/listings/${listing.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>
        <PageHeading
          className="mt-3"
          title="Extras"
          lede={`Boost ${listing.business_name} with optional add-ons.`}
        />
      </div>

      <SectionCard title="Active extras">
        {active.length ? (
          <ul className="divide-y divide-border">
            {active.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <span className="font-semibold text-ink">
                    {r.quantity > 1 ? `${r.quantity}× ` : ""}
                    {r.addons?.name ?? "Add-on"}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.addons?.effect ? effectLabel(r.addons.effect) : ""}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {r.expires_at ? `Until ${formatDate(r.expires_at)}` : "Permanent"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active extras yet.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Add extras"
        description="Instant perks activate right away; manual ones we schedule within 2 business days."
      >
        {available.length ? (
          <BuyExtras
            listingId={listing.id}
            packageId={listing.package_id}
            addons={available}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> No extras are available right now.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Purchase history">
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Add-on</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-ink">
                      {r.quantity > 1 ? `${r.quantity}× ` : ""}
                      {r.addons?.name ?? "Add-on"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatCurrency(r.amount_cents, { fromCents: true })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No purchases yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
