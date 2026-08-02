import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEB = siteUrl();

/**
 * Daily add-on maintenance (call from a scheduled job / Vercel Cron):
 *   1. Expire any active add-on past its expires_at — the entitlement drops
 *      immediately (listing_entitlements already ignores expired rows, and we
 *      flip the status so the record and dashboards agree).
 *   2. Email owners 7 days before expiry with a renewal link, once each
 *      (tracked by renewal_reminded_at so it never repeats).
 *
 * Protected by CRON_SECRET (Authorization: Bearer …).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();

  // 1. Expire.
  const { data: expired } = await admin
    .from("listing_addons")
    .update({ status: "expired" })
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso)
    .select("id");

  // 2. Reminders (7 days out, once each).
  const { data: soon } = await admin
    .from("listing_addons")
    .select(
      "id, expires_at, listing_id, addons(name), listings(business_name, slug, contact_name, contact_email)",
    )
    .eq("status", "active")
    .is("renewal_reminded_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", nowIso)
    .lte("expires_at", in7);

  type Row = {
    id: string;
    expires_at: string | null;
    listing_id: string;
    addons: { name: string | null } | null;
    listings: {
      business_name: string | null;
      slug: string | null;
      contact_name: string | null;
      contact_email: string | null;
    } | null;
  };

  let reminded = 0;
  for (const r of (soon as Row[] | null) ?? []) {
    if (r.listings?.contact_email) {
      await sendTemplateEmail("addon_expiring", {
        to: r.listings.contact_email,
        listingId: r.listing_id,
        context: {
          owner_name: r.listings.contact_name ?? "there",
          listing_name: r.listings.business_name ?? "your listing",
          addon_name: r.addons?.name ?? "an extra",
          expires_on: r.expires_at ? r.expires_at.slice(0, 10) : "",
          extras_link: `${WEB}/dashboard/listings/${r.listing_id}/extras`,
        },
      });
    }
    await admin
      .from("listing_addons")
      .update({ renewal_reminded_at: nowIso })
      .eq("id", r.id);
    reminded += 1;
  }

  return NextResponse.json({
    ok: true,
    expired: expired?.length ?? 0,
    reminded,
  });
}
