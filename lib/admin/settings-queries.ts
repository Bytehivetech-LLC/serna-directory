import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { MenuItem } from "@/types";

const KEYS = [
  "site_name",
  "logo_url",
  "logo_mark_letter",
  "favicon_url",
  "hero_heading",
  "hero_subheading",
  "footer_text",
  "listings_per_page",
  "default_sort",
  "review_sla_days",
  "allow_pending_direct_link",
  "default_map_center",
  "google_maps_browser_key",
  "email_from_name",
  "email_from_address",
  "admin_notification_recipients",
];

export type SettingsMap = Record<string, unknown>;

export async function getAllSettings(): Promise<SettingsMap> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("key, value").in("key", KEYS);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function getMenuItems(): Promise<MenuItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("menu_items")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}
