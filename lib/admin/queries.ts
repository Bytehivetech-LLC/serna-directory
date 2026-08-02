import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { ListingStatus } from "@/types";

/** All listing statuses we surface a count for, in display order. */
const LISTING_STATUSES: ListingStatus[] = [
  "published",
  "pending_review",
  "draft",
  "rejected",
  "unpublished",
  "archived",
];

export type AdminDashboard = {
  pendingReview: number;
  statusCounts: Record<ListingStatus, number>;
  newUsersThisWeek: number;
  revenueThisMonthCents: number;
  recentAudit: {
    id: number;
    actor_email: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
  }[];
  billing: { failedPayments: number; pastDueSubs: number };
  webhookFailures: number;
  /** stripe_events left failed, or processing >15min — a lost/stuck event. */
  stuckStripeEvents: number;
};

async function countListings(
  admin: ReturnType<typeof createAdminClient>,
  status: ListingStatus,
): Promise<number> {
  const { count } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  await requireAdmin();
  const admin = createAdminClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const [
    statusCountValues,
    { count: newUsersThisWeek },
    paymentsRes,
    { data: recentAudit },
    { count: failedPayments },
    { count: pastDueSubs },
    { count: webhookFailures },
    { count: failedEvents },
    { count: stuckProcessing },
  ] = await Promise.all([
    Promise.all(LISTING_STATUSES.map((s) => countListings(admin, s))),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    admin
      .from("payments")
      .select("amount_cents")
      .gte("paid_at", monthStart)
      .not("paid_at", "is", null),
    admin
      .from("audit_log")
      .select("id, actor_email, action, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["past_due", "unpaid"]),
    admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "stripe.webhook_failed")
      .gte("created_at", weekAgo),
    admin
      .from("stripe_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("stripe_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("processed_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString()),
  ]);

  const statusCounts = Object.fromEntries(
    LISTING_STATUSES.map((s, i) => [s, statusCountValues[i]]),
  ) as Record<ListingStatus, number>;

  const revenueThisMonthCents = (paymentsRes.data ?? []).reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0,
  );

  return {
    pendingReview: statusCounts.pending_review,
    statusCounts,
    newUsersThisWeek: newUsersThisWeek ?? 0,
    revenueThisMonthCents,
    recentAudit: recentAudit ?? [],
    billing: {
      failedPayments: failedPayments ?? 0,
      pastDueSubs: pastDueSubs ?? 0,
    },
    webhookFailures: webhookFailures ?? 0,
    stuckStripeEvents: (failedEvents ?? 0) + (stuckProcessing ?? 0),
  };
}

/** The failed / stuck stripe_events for the /admin/stripe-events list. */
export async function getStuckStripeEvents(): Promise<
  { id: string; type: string; status: string; attempts: number; last_error: string | null; processed_at: string }[]
> {
  await requireAdmin();
  const admin = createAdminClient();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("stripe_events")
    .select("id, type, status, attempts, last_error, processed_at")
    .or(`status.eq.failed,and(status.eq.processing,processed_at.lt.${fifteenMinAgo})`)
    .order("processed_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

/* ------------------------------------------------------------------ users -- */

export type UsersQuery = {
  q?: string;
  role?: string;
  verified?: boolean;
  suspended?: boolean;
  hasListings?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_verified: boolean;
  is_suspended: boolean;
  listing_count: number;
  created_at: string;
};

export type UsersPage = {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getUsersPage(query: UsersQuery): Promise<UsersPage> {
  await requireAdmin();
  const admin = createAdminClient();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  const { data, error } = await admin.rpc("admin_list_users", {
    p_q: query.q?.trim() || null,
    p_role: query.role || null,
    p_verified: query.verified ?? null,
    p_suspended: query.suspended ?? null,
    p_has_listings: query.hasListings ?? null,
    p_sort: query.sort ?? "created_at",
    p_dir: query.dir ?? "desc",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error || !data) {
    return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  }

  const rows = data as (UserRow & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;
  return {
    rows: rows.map(({ total_count: _ignored, ...r }) => r),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ------------------------------------------------------------ user detail -- */

export async function getUserDetail(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { data: profile },
    { data: listings },
    { data: subscriptions },
    { data: payments },
    { data: audit },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).maybeSingle(),
    admin
      .from("listings")
      .select("id, business_name, slug, status, is_featured, package_id, created_at")
      .eq("owner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("subscriptions")
      .select(
        "id, status, package_id, current_period_end, cancel_at_period_end, created_at",
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("payments")
      .select("id, amount_cents, currency, status, description, paid_at, receipt_url, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("audit_log")
      .select("id, actor_email, action, entity_type, entity_id, diff, created_at")
      .eq("entity_type", "user")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    profile,
    listings: listings ?? [],
    subscriptions: subscriptions ?? [],
    payments: payments ?? [],
    audit: audit ?? [],
  };
}

/**
 * True when a user has at least one listing that is BOTH published and on a
 * paid package — the condition that blocks a soft delete.
 */
export async function hasActivePaidListings(userId: string): Promise<boolean> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("listings")
    .select("id, packages!inner(price_cents)")
    .eq("owner_id", userId)
    .eq("status", "published")
    .is("deleted_at", null)
    .gt("packages.price_cents", 0)
    .limit(1);
  return Boolean(data && data.length > 0);
}
