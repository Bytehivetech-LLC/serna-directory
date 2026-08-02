"use server";

import { z } from "zod";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { getStripe } from "./client";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const selectionSchema = z.object({
  listingId: z.string().uuid(),
  addons: z
    .array(z.object({ addonId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(20),
});
export type ExtrasSelection = z.infer<typeof selectionSchema>;

function siteOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Checkout for add-ons on a listing the caller owns. Writes listing_addons rows
 * as `pending_payment` keyed to the session id BEFORE redirecting; the webhook
 * flips them to `active` on completion.
 *
 * Mixed intervals: a Stripe Checkout session is either one-time (`payment`) or a
 * single subscription (`subscription`), and a subscription can't mix billing
 * intervals. So:
 *   • all add-ons one-time  → one `payment` session (the common case).
 *   • all add-ons recurring on the SAME interval → one `subscription` session.
 *   • anything mixed (one-time + recurring, or month + year) → we refuse with a
 *     clear message and ask the buyer to purchase them separately. (Running two
 *     sequential sessions is the future upgrade path noted in docs/STRIPE.md.)
 */
export async function createExtrasCheckoutAction(
  input: ExtrasSelection,
): Promise<CheckoutResult> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selection." };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Payments aren't set up yet." };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, owner_id, slug, package_id")
    .eq("id", parsed.data.listingId)
    .maybeSingle();
  if (!listing || listing.owner_id !== user.id) {
    return { ok: false, error: "That listing isn't yours." };
  }

  const ids = parsed.data.addons.map((a) => a.addonId);
  const { data: addons } = await supabase
    .from("addons")
    .select("id, name, price_cents, interval, stripe_price_id, is_active, is_public, max_quantity, package_ids")
    .in("id", ids);
  const byId = new Map((addons ?? []).map((a) => [a.id, a]));

  // Validate each selection and classify intervals.
  const items: { addon: NonNullable<ReturnType<typeof byId.get>>; quantity: number }[] = [];
  for (const sel of parsed.data.addons) {
    const addon = byId.get(sel.addonId);
    if (!addon || !addon.is_active || !addon.is_public) {
      return { ok: false, error: "One of those add-ons is no longer available." };
    }
    // Availability is enforced server-side: an add-on restricted to certain
    // packages can't be bought for a listing on another package, no matter what
    // the browser sends.
    const allowed = Array.isArray(addon.package_ids) ? addon.package_ids : [];
    if (allowed.length > 0 && (!listing.package_id || !allowed.includes(listing.package_id))) {
      return { ok: false, error: `${addon.name} isn't available with this listing's plan.` };
    }
    if (addon.price_cents <= 0 || !addon.stripe_price_id) {
      return { ok: false, error: `${addon.name} isn't set up for payment yet.` };
    }
    if (sel.quantity > addon.max_quantity) {
      return { ok: false, error: `You can buy at most ${addon.max_quantity} of ${addon.name}.` };
    }
    items.push({ addon, quantity: sel.quantity });
  }

  const intervals = new Set(items.map((i) => i.addon.interval));
  const anyRecurring = items.some((i) => i.addon.interval !== "one_time");
  const allOneTime = intervals.size === 1 && intervals.has("one_time");
  const allSameRecurring =
    anyRecurring && intervals.size === 1 && !intervals.has("one_time");

  if (!allOneTime && !allSameRecurring) {
    return {
      ok: false,
      error:
        "These extras bill on different schedules, so they can't go in one checkout. Please buy the one-time and recurring extras separately.",
    };
  }
  const mode: Stripe.Checkout.SessionCreateParams.Mode = allOneTime
    ? "payment"
    : "subscription";

  // Get or create the Stripe customer.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.full_name ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const origin = siteOrigin(await headers());
  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    client_reference_id: user.id,
    line_items: items.map((i) => ({ price: i.addon.stripe_price_id!, quantity: i.quantity })),
    metadata: { purpose: "addons", listing_id: listing.id, user_id: user.id },
    ...(mode === "subscription"
      ? { subscription_data: { metadata: { purpose: "addons", listing_id: listing.id, user_id: user.id } } }
      : {}),
    success_url: `${origin}/dashboard/listings/${listing.id}?checkout=success`,
    cancel_url: `${origin}/dashboard/listings/${listing.id}/extras?checkout=cancelled`,
  });
  if (!session.url) return { ok: false, error: "Couldn't start checkout." };

  // Pre-write the pending purchases, keyed to the session id.
  const rows = items.map((i) => ({
    listing_id: listing.id,
    addon_id: i.addon.id,
    owner_id: user.id,
    quantity: i.quantity,
    status: "pending_payment",
    amount_cents: i.addon.price_cents * i.quantity,
    stripe_checkout_id: session.id,
  }));
  const { error: insErr } = await supabase.from("listing_addons").insert(rows);
  if (insErr) {
    return { ok: false, error: "Couldn't record your purchase. Please try again." };
  }

  return { ok: true, url: session.url };
}
