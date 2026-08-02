"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sniffImageType, readObjectHead } from "@/lib/assets/magic-bytes";

const BUCKET = "listing-images";

/**
 * 6.2 — server-side upload verification. Uploads go browser → Supabase via a
 * signed URL, so nothing on the server ever sees the bytes. After the browser
 * finishes, it calls this: for each just-uploaded object we do a Range read of
 * the first bytes and check the magic number. Anything that isn't a real image
 * (e.g. a text file renamed .webp) has BOTH its objects deleted and its
 * listing_images row removed — so a bad file never persists.
 *
 * Uses the service-role client and only ever DELETES objects that fail
 * verification for the given listing's own folder, so its blast radius is
 * limited to invalid uploads.
 */
export async function confirmListingImagesAction(
  listingId: string,
  fullPaths: string[],
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
    return { ok: false, error: "Invalid listing." };
  }
  const admin = createAdminClient();
  let removed = 0;

  for (const fullPath of fullPaths) {
    // Path must be inside this listing's own folder.
    if (!fullPath.startsWith(`${listingId}/`)) continue;
    const thumbPath = fullPath.replace(/\.webp$/i, "_thumb.webp");

    const head = await readObjectHead(admin, BUCKET, fullPath, 32);
    const kind = head ? sniffImageType(head) : null;
    if (kind) continue; // valid image — keep it

    // Invalid: delete both objects and the row.
    await admin.storage.from(BUCKET).remove([fullPath, thumbPath]).catch(() => {});
    await admin.from("listing_images").delete().eq("storage_path", fullPath);
    removed++;
  }

  return { ok: true, removed };
}
