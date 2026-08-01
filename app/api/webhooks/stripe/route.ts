import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email/send";
import { formatCurrency } from "@/lib/utils/format";
import type { Json } from "@/types/database";

// Raw body is required for signature verification; keep this on Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

const SUB_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
type SubStatus = (typeof SUB_STATUSES)[number];

/** Coerce Stripe's subscription status to our enum (Stripe has extra values). */
function mapSubStatus(status: string): SubStatus {
  return (SUB_STATUSES as readonly string[]).includes(status)
    ? (status as SubStatus)
    : "incomplete";
}

function toIso(unixSeconds: number | null | undefined): string | null {
  return typeof unixSeconds === "number"
    ? new Date(unixSeconds * 1000).toISOString()
    : null;
}

/** Period end lives on subscription items in recent API versions. */
function subPeriodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as
    | { current_period_end?: number }
    | undefined;
  return toIso(item?.current_period_end);
}
function subPeriodStart(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as
    | { current_period_start?: number }
    | undefined;
  return toIso(item?.current_period_start);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    // Never log the body or secret.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency guard: claim the event id first. A conflict means we've already
  // seen it → acknowledge and stop.
  const { error: claimError } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Json,
    processed_at: new Date().toISOString(),
  });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Couldn't record it — ask Stripe to retry.
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, admin, event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(stripe, admin, event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(admin, event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(admin, event.data.object);
        break;
      default:
        break; // unhandled types are acknowledged
    }
  } catch (error) {
    console.error(
      `[stripe] handler failed for ${event.type}:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: Admin,
  session: Stripe.Checkout.Session,
) {
  const listingId = session.metadata?.listing_id;
  const packageId = session.metadata?.package_id;
  const userId = session.metadata?.user_id;
  if (!listingId || !packageId || !userId) return;

  const { data: pkg } = await admin
    .from("packages")
    .select("id, requires_approval, allows_featured, priority_rank")
    .eq("id", packageId)
    .maybeSingle();

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  let subscriptionId: string | null = null;
  let periodEnd: string | null = null;
  let subscriptionRowId: string | null = null;

  if (session.mode === "subscription" && session.subscription) {
    subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = subPeriodEnd(sub);

    const { data: subRow } = await admin
      .from("subscriptions")
      .insert({
        user_id: userId,
        package_id: packageId,
        listing_id: listingId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: mapSubStatus(sub.status),
        current_period_start: subPeriodStart(sub),
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
      })
      .select("id")
      .maybeSingle();
    subscriptionRowId = subRow?.id ?? null;
  }

  // Activate the listing.
  const status = pkg?.requires_approval === false ? "published" : "pending_review";
  await admin
    .from("listings")
    .update({
      package_id: packageId,
      status,
      is_featured: Boolean(pkg?.allows_featured),
      priority_rank: pkg?.priority_rank ?? 0,
      featured_until: periodEnd,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", listingId);

  // Payment row (deduped against the invoice on renewals).
  const invoiceId =
    typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  await admin.from("payments").insert({
    user_id: userId,
    listing_id: listingId,
    subscription_id: subscriptionRowId,
    stripe_checkout_id: session.id,
    stripe_invoice_id: invoiceId,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  // Confirmation email (best-effort).
  const { data: listing } = await admin
    .from("listings")
    .select("business_name, slug, contact_name, contact_email")
    .eq("id", listingId)
    .maybeSingle();
  if (listing?.contact_email) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await sendTemplateEmail("payment_receipt", {
      to: listing.contact_email,
      userId,
      listingId,
      context: {
        owner_name: listing.contact_name,
        listing_name: listing.business_name,
        total: formatCurrency(session.amount_total ?? 0, { fromCents: true }),
        line_items: listing.business_name,
        receipt_url: `${origin}/listing/${listing.slug}`,
        next_steps: "Your Featured upgrade is active.",
      },
    });
  }
}

async function handleSubscriptionUpdated(admin: Admin, sub: Stripe.Subscription) {
  const periodEnd = subPeriodEnd(sub);
  await admin
    .from("subscriptions")
    .update({
      status: mapSubStatus(sub.status),
      current_period_start: subPeriodStart(sub),
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("stripe_subscription_id", sub.id);

  const listingId = sub.metadata?.listing_id;
  if (listingId && (sub.status === "active" || sub.status === "trialing")) {
    await admin
      .from("listings")
      .update({ featured_until: periodEnd })
      .eq("id", listingId);
  }
}

async function handleSubscriptionDeleted(admin: Admin, sub: Stripe.Subscription) {
  await admin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id);

  const listingId = sub.metadata?.listing_id;
  if (!listingId) return;

  const { data: freePkg } = await admin
    .from("packages")
    .select("id, max_images, priority_rank")
    .eq("is_default", true)
    .maybeSingle();
  if (!freePkg) return;

  const { count } = await admin
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  // Unpublish only if the listing now exceeds the free plan's limits.
  const exceeds = (count ?? 0) > (freePkg.max_images ?? 8);
  const { data: current } = await admin
    .from("listings")
    .select("status")
    .eq("id", listingId)
    .maybeSingle();

  await admin
    .from("listings")
    .update({
      package_id: freePkg.id,
      is_featured: false,
      priority_rank: freePkg.priority_rank ?? 0,
      featured_until: null,
      status: exceeds ? "unpublished" : (current?.status ?? "published"),
    })
    .eq("id", listingId);
}

async function handleInvoicePaid(
  stripe: Stripe,
  admin: Admin,
  invoice: Stripe.Invoice,
) {
  // The invoice belongs to a subscription; skip if already recorded at checkout.
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_invoice_id", invoice.id ?? "")
    .maybeSingle();
  if (existing) return;

  const subId = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription;
  const subscriptionId = typeof subId === "string" ? subId : subId?.id ?? null;

  let subRowId: string | null = null;
  let listingId: string | null = null;
  let userId: string | null = null;
  let periodEnd: string | null = null;
  if (subscriptionId) {
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("id, listing_id, user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    subRowId = subRow?.id ?? null;
    listingId = subRow?.listing_id ?? null;
    userId = subRow?.user_id ?? null;

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = subPeriodEnd(sub);
  }

  await admin.from("payments").insert({
    user_id: userId,
    listing_id: listingId,
    subscription_id: subRowId,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    status: "paid",
    receipt_url: invoice.hosted_invoice_url ?? null,
    paid_at: new Date().toISOString(),
  });

  if (listingId && periodEnd) {
    await admin
      .from("listings")
      .update({ featured_until: periodEnd })
      .eq("id", listingId);
  }
}

async function handleInvoiceFailed(admin: Admin, invoice: Stripe.Invoice) {
  const subId = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription;
  const subscriptionId = typeof subId === "string" ? subId : subId?.id ?? null;
  if (!subscriptionId) return;

  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("user_id, listing_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!subRow?.user_id) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", subRow.user_id)
    .maybeSingle();
  if (profile?.email) {
    await sendTemplateEmail("payment_failed", {
      to: profile.email,
      userId: subRow.user_id,
      listingId: subRow.listing_id,
      context: { owner_name: profile.full_name ?? "there", grace_days: 7 },
    });
  }
}

async function handleChargeRefunded(admin: Admin, charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;
  await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId);
}
