import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { Package } from "@/types";

export type PackageWithCount = Package & { subscriber_count: number };

/** Live subscriber counts (active + trialing) keyed by package id. */
async function liveSubscriberCounts(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, number>> {
  const { data } = await admin
    .from("subscriptions")
    .select("package_id")
    .in("status", ["active", "trialing"]);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.package_id) continue;
    counts.set(row.package_id, (counts.get(row.package_id) ?? 0) + 1);
  }
  return counts;
}

export async function getPackagesWithCounts(): Promise<PackageWithCount[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: packages }, counts] = await Promise.all([
    admin.from("packages").select("*").order("sort_order", { ascending: true }),
    liveSubscriberCounts(admin),
  ]);
  return (packages ?? []).map((p) => ({
    ...p,
    subscriber_count: counts.get(p.id) ?? 0,
  }));
}

export async function getPackage(id: string): Promise<Package | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("packages").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Active/trialing subscriber count for a single package (delete guard). */
export async function activeSubscriberCount(id: string): Promise<number> {
  await requireAdmin();
  const admin = createAdminClient();
  const { count } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("package_id", id)
    .in("status", ["active", "trialing"]);
  return count ?? 0;
}
