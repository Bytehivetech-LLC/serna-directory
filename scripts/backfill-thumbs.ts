/**
 * 6.1 — backfill missing cover thumbnails.
 *
 * Finds listing_images rows with thumb_path NULL, reports the count, and (if
 * `sharp` is available) generates a 400px WebP thumbnail for each, uploads it
 * next to the original, and sets thumb_path.
 *
 * Run: `npx tsx scripts/backfill-thumbs.ts` (needs SUPABASE_SERVICE_ROLE_KEY +
 * NEXT_PUBLIC_SUPABASE_URL in the environment). Dry by default — pass `--write`
 * to actually generate and upload.
 *
 * This is a maintenance script, not part of the app bundle.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "listing-images";
const THUMB_WIDTH = 400;
const WRITE = process.argv.includes("--write");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("listing_images")
    .select("id, listing_id, storage_path, thumb_path")
    .is("thumb_path", null);
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const missing = (rows ?? []).filter((r) => r.storage_path);
  console.log(`listing_images rows with no thumb_path: ${missing.length}`);
  if (!missing.length) {
    console.log("Nothing to backfill.");
    return;
  }
  if (!WRITE) {
    console.log("Dry run. Re-run with --write to generate thumbnails.");
    return;
  }

  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as unknown as typeof import("sharp");
  } catch {
    console.error("`sharp` isn't installed. Run `npm i -D sharp` and retry.");
    process.exit(1);
  }

  let done = 0;
  for (const row of missing) {
    try {
      const { data: file } = await supabase.storage.from(BUCKET).download(row.storage_path!);
      if (!file) continue;
      const input = Buffer.from(await file.arrayBuffer());
      const out = await sharp(input).resize(THUMB_WIDTH).webp({ quality: 80 }).toBuffer();
      const thumbPath = row.storage_path!.replace(/(\.\w+)?$/, "") + `-thumb.webp`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, out, { contentType: "image/webp", upsert: true });
      if (up.error) {
        console.warn(`  upload failed for ${row.id}: ${up.error.message}`);
        continue;
      }
      await supabase.from("listing_images").update({ thumb_path: thumbPath }).eq("id", row.id);
      done++;
    } catch (e) {
      console.warn(`  failed for ${row.id}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Generated ${done} thumbnail${done === 1 ? "" : "s"}.`);
}

void main();
