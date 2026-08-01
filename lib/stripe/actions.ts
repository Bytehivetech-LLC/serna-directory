"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { getStripe } from "./client";
import { ensurePackagePrice } from "./pricing";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

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
 * Create a Stripe Checkout session for upgrading a listing to a paid package.
 * Returns the URL for the browser to redirect to. NEVER writes any paid state —
 * the webhook is the only source of truth.
 */
export async function createCheckoutSession(
  listingId: string,
  packageId: string,
): Promise<CheckoutResult> {
  if (
    !z.string().uuid().safeParse(listingId).success ||
    !z.string().uuid().safeParse(packageId).success
  ) {
    return { ok: false, error: "Invalid request." };
  }

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Payments aren't set up yet." };

  const user = await requireUser();
  const supabase = await createClient();

  // Ownership (RLS also enforces this).
  const { data: listing } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.owner_id !== user.id) {
    return { ok: false, error: "That listing isn't yours." };
  }

  const { data: pkg } = await supabase
    .from("packages")
    .select("id, name, price_cents, interval, currency, stripe_product_id, stripe_price_id, is_active")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || !pkg.is_active || pkg.price_cents <= 0) {
    return { ok: false, error: "That plan isn't available." };
  }

  const priceId = await ensurePackagePrice(pkg);
  if (!priceId) return { ok: false, error: "That plan isn't set up for payment yet." };

  // Get or create the Stripe customer, stored on the profile.
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
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = siteOrigin(await headers());
  const mode = pkg.interval === "one_time" ? "payment" : "subscription";

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { listing_id: listingId, package_id: packageId, user_id: user.id },
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata: { listing_id: listingId, package_id: packageId, user_id: user.id },
          },
        }
      : {}),
    success_url: `${origin}/dashboard/listings/${listingId}?checkout=success`,
    cancel_url: `${origin}/dashboard/listings/${listingId}?checkout=cancelled`,
  });

  if (!session.url) return { ok: false, error: "Couldn't start checkout." };
  return { ok: true, url: session.url };
}

/** Billing Portal session for the current user's Stripe customer. */
export async function createPortalSession(): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Payments aren't set up yet." };

  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return { ok: false, error: "You don't have a billing account yet." };
  }

  const origin = siteOrigin(await headers());
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  });
  return { ok: true, url: session.url };
}
