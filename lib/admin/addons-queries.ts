import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { Addon } from "@/types";

export type AddonWithSales = Addon & { times_sold: number };

/** Sold counts (active or fulfilled) keyed by addon id. */
async function soldCounts(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, number>> {
  const { data } = await admin
    .from("listing_addons")
    .select("addon_id")
    .in("status", ["active", "fulfilled"]);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.addon_id, (counts.get(row.addon_id) ?? 0) + 1);
  }
  return counts;
}

export async function getAddonsWithSales(): Promise<AddonWithSales[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: addons }, counts] = await Promise.all([
    admin.from("addons").select("*").order("sort_order", { ascending: true }),
    soldCounts(admin),
  ]);
  return (addons ?? []).map((a) => ({ ...a, times_sold: counts.get(a.id) ?? 0 }));
}

export async function getAddon(id: string): Promise<Addon | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("addons").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Active purchases of an add-on (delete guard). */
export async function activePurchaseCount(id: string): Promise<number> {
  await requireAdmin();
  const admin = createAdminClient();
  const { count } = await admin
    .from("listing_addons")
    .select("id", { count: "exact", head: true })
    .eq("addon_id", id)
    .in("status", ["active", "pending_payment"]);
  return count ?? 0;
}
