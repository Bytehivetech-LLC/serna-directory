import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";

export type StoragePanel = {
  totalBytes: number;
  pending: number;
  failed: number;
  lastSweep: string | null;
};

export async function getStoragePanel(): Promise<StoragePanel> {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: images }, { count: pending }, { count: failed }, { data: sweep }] =
    await Promise.all([
      admin.from("listing_images").select("bytes").limit(100000),
      admin.from("asset_deletion_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("asset_deletion_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      admin.from("site_settings").select("value").eq("key", "last_sweep_at").maybeSingle(),
    ]);

  const totalBytes = (images ?? []).reduce((sum, r) => sum + (r.bytes ?? 0), 0);
  return {
    totalBytes,
    pending: pending ?? 0,
    failed: failed ?? 0,
    lastSweep: typeof sweep?.value === "string" ? sweep.value : null,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
