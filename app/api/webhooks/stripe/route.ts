import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email/send";
import { sendAdminAlert } from "@/lib/email/admin-alerts";
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

/**
 * Record a webhook failure to the audit log so the admin dashboard can surface
 * it. The actor is the system (no user session on a webhook). Best-effort — a
 * logging failure must never change the 500 we're about to return to Stripe.
 */
async function recordWebhookFailure(
  admin: Admin,
  request: NextRequest,
  info: { eventId: string | null; eventType: string | null; error: string },
): Promise<void> {
  try {
    await admin.from("audit_log").insert({
      actor_id: null,
      actor_email: "stripe-webhook",
      action: "stripe.webhook_failed",
      entity_type: "stripe_event",
      entity_id: info.eventId,
      diff: { type: info.eventType, error: info.error } as unknown as Json,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[stripe] audit insert failed:", err);
  }
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
  const MAX_ATTEMPTS = 5;

  // Idempotency + retry lifecycle. Claim the event as 'processing'. On a
  // duplicate, the previous outcome decides what happens:
  //   done       -> already handled; acknowledge and stop.
  //   processing -> a previous attempt died mid-flight; reprocess.
  //   failed     -> a previous attempt threw; reprocess (Stripe is retrying).
  // The claim only becomes permanent ('done') AFTER the handler succeeds, so a
  // transient error can never strand a paid event.
  const nowIso = new Date().toISOString();
  let attempts = 1;

  const { error: claimError } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Json,
    processed_at: nowIso,
    status: "processing",
    attempts: 1,
    updated_at: nowIso,
  });

  if (claimError) {
    if (claimError.code === "23505") {
      const { data: existing } = await admin
        .from("stripe_events")
        .select("status, attempts")
        .eq("id", event.id)
        .maybeSingle();

      if (!existing || existing.status === "done") {
        return NextResponse.json({ received: true, duplicate: true });
      }

      attempts = (existing.attempts ?? 0) + 1;

      // Runaway guard: a permanently broken event must not loop forever.
      // Surface it to a human and acknowledge so Stripe stops retrying.
      if (attempts > MAX_ATTEMPTS) {
        await admin
          .from("stripe_events")
          .update({ attempts, status: "failed", updated_at: new Date().toISOString() })
          .eq("id", event.id);
        await recordWebhookFailure(admin, request, {
          eventId: event.id,
          eventType: event.type,
          error: `Gave up after ${MAX_ATTEMPTS} attempts; left status=failed.`,
        });
        await sendAdminAlert("admin_system_alert", {
          message: `Stripe event ${event.id} (${event.type}) failed ${attempts} times and was abandoned. Review it at /admin/stripe-events and replay it from the Stripe dashboard once the cause is fixed.`,
        });
        return NextResponse.json({ received: true, abandoned: true });
      }

      await admin
        .from("stripe_events")
        .update({ status: "processing", attempts, last_error: null, updated_at: new Date().toISOString() })
        .eq("id", event.id);
    } else {
      // Couldn't even record it — ask Stripe to retry.
      await recordWebhookFailure(admin, request, {
        eventId: event.id,
        eventType: event.type,
        error: `Could not record event: ${claimError.message}`,
      });
      return NextResponse.json({ error: "Could not record event" }, { status: 500 });
    }
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stripe] handler failed for ${event.type}:`, message);
    // Release the claim as 'failed' so Stripe's retry reprocesses it (never
    // store the raw payload in last_error).
    await admin
      .from("stripe_events")
      .update({ status: "failed", last_error: message.slice(0, 500), attempts, updated_at: new Date().toISOString() })
      .eq("id", event.id);
    await recordWebhookFailure(admin, request, {
      eventId: event.id,
      eventType: event.type,
      error: message,
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  // Success — now the claim becomes permanent.
  await admin
    .from("stripe_events")
    .update({ status: "done", last_error: null, updated_at: new Date().toISOString() })
    .eq("id", event.id);

  return NextResponse.json({ received: true });
}

/**
 * Activate the add-ons bought in a checkout session: flip their pending rows to
 * active, stamp starts_at, compute expires_at from the add-on's duration_days,
 * and link the payment. The webhook is the ONLY place a purchase becomes active.
 */
async function activatePurchasedAddons(
  admin: Admin,
  sessionId: string,
  links: { paymentId: string | null; invoiceId: string | null },
): Promise<{ addonId: string; quantity: number; name: string }[]> {
  const { data: pending } = await admin
    .from("listing_addons")
    .select("id, addon_id, quantity")
    .eq("stripe_checkout_id", sessionId)
    .eq("status", "pending_payment");
  if (!pending?.length) return [];

  const addonIds = Array.from(new Set(pending.map((p) => p.addon_id)));
  const { data: addons } = await admin
    .from("addons")
    .select("id, duration_days, name")
    .in("id", addonIds);
  const meta = new Map(
    (addons ?? []).map((a) => [a.id, { days: a.duration_days, name: a.name }]),
  );

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const result: { addonId: string; quantity: number; name: string }[] = [];
  for (const p of pending) {
    const days = meta.get(p.addon_id)?.days ?? null;
    const expires = days ? new Date(nowMs + days * 86400000).toISOString() : null;
    await admin
      .from("listing_addons")
      .update({
        status: "active",
        starts_at: nowIso,
        expires_at: expires,
        payment_id: links.paymentId,
        stripe_invoice_id: links.invoiceId,
      })
      .eq("id", p.id);
    result.push({
      addonId: p.addon_id,
      quantity: p.quantity,
      name: meta.get(p.addon_id)?.name ?? "Add-on",
    });
  }
  return result;
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: Admin,
  session: Stripe.Checkout.Session,
) {
  const listingId = session.metadata?.listing_id;
  const packageId = session.metadata?.package_id;
  const userId = session.metadata?.user_id;
  const purpose = session.metadata?.purpose;

  // Add-ons-only checkout: record the payment, activate the add-ons, done. Never
  // touches the listing's package.
  if (purpose === "addons") {
    if (!listingId || !userId) return;
    const invoiceId =
      typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
    const { data: payment } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        listing_id: listingId,
        stripe_checkout_id: session.id,
        stripe_invoice_id: invoiceId,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        status: "paid",
        description: "Add-ons",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    const activated = await activatePurchasedAddons(admin, session.id, {
      paymentId: payment?.id ?? null,
      invoiceId,
    });

    // Confirmation email — itemised, with next steps for manual add-ons.
    const { data: listing } = await admin
      .from("listings")
      .select("business_name, contact_name, contact_email")
      .eq("id", listingId)
      .maybeSingle();
    if (listing?.contact_email && activated.length) {
      const items = activated
        .map((a) => `${a.quantity}× ${a.name}`)
        .join(", ");
      await sendTemplateEmail("addons_purchased", {
        to: listing.contact_email,
        userId,
        listingId,
        context: {
          owner_name: listing.contact_name ?? "there",
          listing_name: listing.business_name,
          items,
          total: formatCurrency(session.amount_total ?? 0, { fromCents: true }),
        },
      });
    }
    return;
  }

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
    const origin = siteUrl();
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

  const { data: refunded } = await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id");

  // Any add-ons paid by these payments lose their entitlement.
  const paymentIds = (refunded ?? []).map((p) => p.id);
  if (paymentIds.length) {
    await admin
      .from("listing_addons")
      .update({ status: "refunded" })
      .in("payment_id", paymentIds);
  }
}
