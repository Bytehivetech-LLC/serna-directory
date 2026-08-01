import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/types";

export type OwnerListingRow = Pick<
  Listing,
  | "id"
  | "business_name"
  | "slug"
  | "status"
  | "is_featured"
  | "city"
  | "completeness"
  | "view_count"
  | "inquiry_count"
  | "rejection_reason"
  | "package_id"
>;

export async function getOwnerListings(
  userId: string,
): Promise<OwnerListingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, business_name, slug, status, is_featured, city, completeness, view_count, inquiry_count, rejection_reason, package_id",
    )
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as OwnerListingRow[];
}

/** The owner's max listings — best of the free/default plan and any active sub. */
export async function getListingLimit(userId: string): Promise<number> {
  const supabase = await createClient();
  const [{ data: defaultPkg }, { data: activeSub }] = await Promise.all([
    supabase.from("packages").select("max_listings").eq("is_default", true).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("package_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  let limit = defaultPkg?.max_listings ?? 1;
  if (activeSub?.package_id) {
    const { data: subPkg } = await supabase
      .from("packages")
      .select("max_listings")
      .eq("id", activeSub.package_id)
      .maybeSingle();
    if (subPkg?.max_listings) limit = Math.max(limit, subPkg.max_listings);
  }
  return limit;
}

export type OwnerOverview = {
  listings: OwnerListingRow[];
  listingCount: number;
  listingLimit: number;
  totalViews: number;
  inquiriesThisMonth: number;
  actions: {
    rejected: OwnerListingRow[];
    paymentPastDue: boolean;
    incompleteProfile: boolean;
  };
};

export async function getOwnerOverview(userId: string): Promise<OwnerOverview> {
  const supabase = await createClient();
  const listings = await getOwnerListings(userId);
  const listingIds = listings.map((l) => l.id);

  // Listing limit: the best max_listings across the free/default package and any
  // active subscription package.
  const [{ data: defaultPkg }, { data: activeSub }, { data: profile }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("max_listings")
        .eq("is_default", true)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, package_id")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  let listingLimit = defaultPkg?.max_listings ?? 1;
  if (activeSub?.package_id) {
    const { data: subPkg } = await supabase
      .from("packages")
      .select("max_listings")
      .eq("id", activeSub.package_id)
      .maybeSingle();
    if (subPkg?.max_listings) {
      listingLimit = Math.max(listingLimit, subPkg.max_listings);
    }
  }

  const paymentPastDue = await hasPastDue(userId);

  // Inquiries this month.
  let inquiriesThisMonth = 0;
  if (listingIds.length) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("listing_id", listingIds)
      .gte("created_at", monthStart);
    inquiriesThisMonth = count ?? 0;
  }

  const totalViews = listings.reduce((sum, l) => sum + (l.view_count ?? 0), 0);

  return {
    listings,
    listingCount: listings.length,
    listingLimit,
    totalViews,
    inquiriesThisMonth,
    actions: {
      rejected: listings.filter((l) => l.status === "rejected"),
      paymentPastDue,
      incompleteProfile: profile?.onboarding_complete === false,
    },
  };
}

async function hasPastDue(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "past_due");
  return (count ?? 0) > 0;
}
