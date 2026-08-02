import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";

export type RevenueSummary = {
  thisMonthCents: number;
  lastMonthCents: number;
  mrrCents: number;
  activeSubscriptions: number;
  churnThisMonth: number;
};

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  await requireAdmin();
  const admin = createAdminClient();

  const now = new Date();
  const thisMonth = monthStart(now).toISOString();
  const lastMonth = monthStart(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  ).toISOString();

  const [thisRes, lastRes, activeSubs, churn] = await Promise.all([
    admin
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", thisMonth),
    admin
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", lastMonth)
      .lt("paid_at", thisMonth),
    admin
      .from("subscriptions")
      .select("package_id")
      .in("status", ["active", "trialing"]),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .not("canceled_at", "is", null)
      .gte("canceled_at", thisMonth),
  ]);

  const sum = (rows: { amount_cents: number }[] | null) =>
    (rows ?? []).reduce((t, r) => t + (r.amount_cents ?? 0), 0);

  // MRR: normalise each active subscription's package price to a monthly figure.
  let mrrCents = 0;
  const subs = activeSubs.data ?? [];
  const pkgIds = Array.from(new Set(subs.map((s) => s.package_id).filter(Boolean)));
  if (pkgIds.length) {
    const { data: pkgs } = await admin
      .from("packages")
      .select("id, price_cents, interval")
      .in("id", pkgIds as string[]);
    const priceMap = new Map(
      (pkgs ?? []).map((p) => [p.id, { cents: p.price_cents, interval: p.interval }]),
    );
    for (const s of subs) {
      const p = s.package_id ? priceMap.get(s.package_id) : undefined;
      if (!p) continue;
      if (p.interval === "month") mrrCents += p.cents;
      else if (p.interval === "year") mrrCents += Math.round(p.cents / 12);
    }
  }

  return {
    thisMonthCents: sum(thisRes.data),
    lastMonthCents: sum(lastRes.data),
    mrrCents,
    activeSubscriptions: subs.length,
    churnThisMonth: churn.count ?? 0,
  };
}

/* ------------------------------------------------------------- payments -- */

export type PaymentsQuery = {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
  receipt_url: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_checkout_id: string | null;
  user_email: string | null;
  listing_name: string | null;
  listing_id: string | null;
};

type RawPayment = Omit<PaymentRow, "user_email" | "listing_name"> & {
  profiles: { email: string | null } | null;
  listings: { business_name: string | null } | null;
};

const SELECT =
  "id, amount_cents, currency, status, description, paid_at, created_at, receipt_url, stripe_payment_intent_id, stripe_invoice_id, stripe_checkout_id, listing_id, profiles(email), listings(business_name)";

function applyFilters<T>(q: T, query: PaymentsQuery): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let b = q as any;
  if (query.status) b = b.eq("status", query.status);
  if (query.from) b = b.gte("created_at", query.from);
  if (query.to) b = b.lt("created_at", `${query.to}T23:59:59Z`);
  return b as T;
}

function mapRow(r: RawPayment): PaymentRow {
  return {
    id: r.id,
    amount_cents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    description: r.description,
    paid_at: r.paid_at,
    created_at: r.created_at,
    receipt_url: r.receipt_url,
    stripe_payment_intent_id: r.stripe_payment_intent_id,
    stripe_invoice_id: r.stripe_invoice_id,
    stripe_checkout_id: r.stripe_checkout_id,
    listing_id: r.listing_id,
    user_email: r.profiles?.email ?? null,
    listing_name: r.listings?.business_name ?? null,
  };
}

export type PaymentsPage = {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getPaymentsPage(query: PaymentsQuery): Promise<PaymentsPage> {
  await requireAdmin();
  const admin = createAdminClient();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const fromIdx = (page - 1) * pageSize;

  const base = applyFilters(
    admin.from("payments").select(SELECT, { count: "exact" }),
    query,
  ).order("created_at", { ascending: false });

  const { data, count } = await base.range(fromIdx, fromIdx + pageSize - 1);
  const total = count ?? 0;

  return {
    rows: ((data as RawPayment[] | null) ?? []).map(mapRow),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** All rows matching the filter (no pagination) — for CSV export. */
export async function getPaymentsForExport(query: PaymentsQuery): Promise<PaymentRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const base = applyFilters(
    admin.from("payments").select(SELECT),
    query,
  ).order("created_at", { ascending: false });
  const { data } = await base.limit(5000);
  return ((data as RawPayment[] | null) ?? []).map(mapRow);
}

/* --------------------------------------------------------- subscriptions -- */

export type SubscriptionRow = {
  id: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  user_email: string | null;
  package_name: string | null;
};

export async function getActiveSubscriptions(): Promise<SubscriptionRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select(
      "id, status, stripe_subscription_id, current_period_end, cancel_at_period_end, profiles(email), packages(name)",
    )
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    (data as
      | (Omit<SubscriptionRow, "user_email" | "package_name"> & {
          profiles: { email: string | null } | null;
          packages: { name: string | null } | null;
        })[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    status: s.status,
    stripe_subscription_id: s.stripe_subscription_id,
    current_period_end: s.current_period_end,
    cancel_at_period_end: s.cancel_at_period_end,
    user_email: s.profiles?.email ?? null,
    package_name: s.packages?.name ?? null,
  }));
}
