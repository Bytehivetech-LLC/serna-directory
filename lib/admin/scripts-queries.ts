import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import type { Tables } from "@/types";

export type ScriptRow = Tables<"site_scripts">;

export async function getScripts(): Promise<ScriptRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("site_scripts").select("*").order("sort_order", { ascending: true });
  return data ?? [];
}
