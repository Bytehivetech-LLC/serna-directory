import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { sendTemplateEmail } from "@/lib/email/send";

type Admin = ReturnType<typeof createAdminClient>;
const WEB = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const BUCKETS = ["listing-images", "site-assets", "avatars"];

/** Enqueue a storage object for the drain worker. Never deletes storage.objects
 * directly (that orphans the file) — everything goes through the queue. */
export async function enqueueAssetDeletion(
  admin: Admin,
  bucket: string,
  path: string,
  reason: string,
  listingId: string | null = null,
): Promise<void> {
  if (!path) return;
  await admin.from("asset_deletion_queue").insert({
    bucket_id: bucket,
    object_path: path,
    reason,
    listing_id: listingId,
    status: "pending",
    attempts: 0,
  });
}

/** Turn a public storage URL back into its object path, or null. */
export function pathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

/* ------------------------------------------------------------ addon expiry --- */

export async function runAddonMaintenance(admin: Admin): Promise<{ expired: number; reminded: number }> {
  const now = new Date();
  const nowIso = now.toISOString();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();

  const { data: expired } = await admin
    .from("listing_addons")
    .update({ status: "expired" })
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso)
    .select("id");

  const { data: soon } = await admin
    .from("listing_addons")
    .select("id, expires_at, listing_id, addons(name), listings(business_name, contact_name, contact_email)")
    .eq("status", "active")
    .is("renewal_reminded_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", nowIso)
    .lte("expires_at", in7);

  type Row = {
    id: string; expires_at: string | null; listing_id: string;
    addons: { name: string | null } | null;
    listings: { business_name: string | null; contact_name: string | null; contact_email: string | null } | null;
  };
  let reminded = 0;
  for (const r of (soon as Row[] | null) ?? []) {
    if (r.listings?.contact_email) {
      await sendTemplateEmail("addon_expiring", {
        to: r.listings.contact_email,
        listingId: r.listing_id,
        context: {
          owner_name: r.listings.contact_name ?? "there",
          listing_name: r.listings.business_name ?? "your listing",
          addon_name: r.addons?.name ?? "an extra",
          expires_on: r.expires_at ? r.expires_at.slice(0, 10) : "",
          extras_link: `${WEB}/dashboard/listings/${r.listing_id}/extras`,
        },
      });
    }
    await admin.from("listing_addons").update({ renewal_reminded_at: nowIso }).eq("id", r.id);
    reminded += 1;
  }
  return { expired: expired?.length ?? 0, reminded };
}

/* ---------------------------------------------------------------- purge --- */

/** Hard-delete listings whose grace period has elapsed. The row cascade removes
 * listing_images and the DB trigger enqueues each storage path. */
export async function runPurge(admin: Admin): Promise<{ purged: number }> {
  const settings = await getSettings(["deletion_grace_days"]);
  const graceDays = typeof settings.deletion_grace_days === "number" ? settings.deletion_grace_days : 30;
  const cutoff = new Date(Date.now() - graceDays * 86400000).toISOString();

  const { data: due } = await admin
    .from("listings")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(200);

  let purged = 0;
  for (const l of due ?? []) {
    const { error } = await admin.from("listings").delete().eq("id", l.id);
    if (!error) purged += 1;
  }
  return { purged };
}

/* ---------------------------------------------------------------- drain --- */

export async function runDrain(admin: Admin): Promise<{ done: number; failed: number }> {
  const { data: pending } = await admin
    .from("asset_deletion_queue")
    .select("id, bucket_id, object_path, attempts")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(100);

  let done = 0;
  let failed = 0;
  for (const row of pending ?? []) {
    const { error } = await admin.storage.from(row.bucket_id).remove([row.object_path]);
    if (!error) {
      await admin.from("asset_deletion_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", row.id);
      done += 1;
    } else {
      const attempts = (row.attempts ?? 0) + 1;
      await admin
        .from("asset_deletion_queue")
        .update({ attempts, last_error: error.message, status: attempts >= 3 ? "failed" : "pending" })
        .eq("id", row.id);
      if (attempts >= 3) failed += 1;
    }
  }
  return { done, failed };
}

/* ---------------------------------------------------------------- sweep --- */

/** Weekly: find storage objects with no live DB reference, older than 24h, and
 * enqueue them. Covers abandoned drafts and half-finished uploads in
 * listing-images (the common leak); site-assets/avatars are kept tidy by the
 * enqueue-on-replace paths. */
export async function runSweep(admin: Admin): Promise<{ enqueued: number }> {
  const { data: images } = await admin.from("listing_images").select("storage_path, thumb_path");
  const referenced = new Set<string>();
  for (const i of images ?? []) {
    if (i.storage_path) referenced.add(i.storage_path);
    if (i.thumb_path) referenced.add(i.thumb_path);
  }

  const cutoff = Date.now() - 24 * 3600 * 1000;
  let enqueued = 0;

  const { data: folders } = await admin.storage.from("listing-images").list("", { limit: 1000 });
  for (const folder of folders ?? []) {
    if (folder.id) continue; // a file at the root, not a listing folder
    const { data: files } = await admin.storage.from("listing-images").list(folder.name, { limit: 1000 });
    for (const file of files ?? []) {
      const path = `${folder.name}/${file.name}`;
      const created = file.created_at ? new Date(file.created_at).getTime() : 0;
      if (!referenced.has(path) && created && created < cutoff) {
        await enqueueAssetDeletion(admin, "listing-images", path, "sweep:unreferenced");
        enqueued += 1;
      }
    }
  }

  await admin.from("site_settings").upsert({ key: "last_sweep_at", value: new Date().toISOString() as never });
  return { enqueued };
}

export { BUCKETS };
