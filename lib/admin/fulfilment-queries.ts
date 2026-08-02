import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";

export type FulfilmentItem = {
  id: string;
  quantity: number;
  createdAt: string;
  daysWaiting: number;
  addonName: string;
  fulfilmentNote: string | null;
  listingId: string;
  listingName: string;
  listingSlug: string | null;
  ownerEmail: string | null;
  stripePaymentIntent: string | null;
};

/** Active add-ons whose effect is 'manual' — the human work queue, oldest first. */
export async function getFulfilmentQueue(): Promise<FulfilmentItem[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("listing_addons")
    .select(
      "id, quantity, created_at, listing_id, addons!inner(name, effect, fulfilment_note), listings(business_name, slug), profiles(email), payments(stripe_payment_intent_id)",
    )
    .eq("status", "active")
    .eq("addons.effect", "manual")
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    quantity: number;
    created_at: string;
    listing_id: string;
    addons: { name: string | null; fulfilment_note: string | null } | null;
    listings: { business_name: string | null; slug: string | null } | null;
    profiles: { email: string | null } | null;
    payments: { stripe_payment_intent_id: string | null } | null;
  };

  const now = Date.now();
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    quantity: r.quantity,
    createdAt: r.created_at,
    daysWaiting: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
    addonName: r.addons?.name ?? "Add-on",
    fulfilmentNote: r.addons?.fulfilment_note ?? null,
    listingId: r.listing_id,
    listingName: r.listings?.business_name ?? "Listing",
    listingSlug: r.listings?.slug ?? null,
    ownerEmail: r.profiles?.email ?? null,
    stripePaymentIntent: r.payments?.stripe_payment_intent_id ?? null,
  }));
}
