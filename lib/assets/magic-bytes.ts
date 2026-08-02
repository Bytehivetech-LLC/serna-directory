import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type ImageKind = "webp" | "png" | "jpeg" | "avif";

/**
 * Identify an image by its magic bytes — never trust the filename or the
 * client-declared content type. Returns null for anything that isn't one of our
 * allowed formats (so a text file renamed .webp is rejected).
 */
export function sniffImageType(b: Uint8Array): ImageKind | null {
  // WebP: "RIFF"...."WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "webp";
  // PNG: 89 50 4E 47
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "png";
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  // AVIF: "ftyp" box at offset 4
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)
    return "avif";
  return null;
}

/**
 * Read the first `n` bytes of a storage object with a real Range request against
 * a short-lived signed URL (service-role). Returns null if it can't be read.
 */
export async function readObjectHead(
  admin: Admin,
  bucket: string,
  path: string,
  n = 32,
): Promise<Uint8Array | null> {
  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return null;
  try {
    const res = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${n - 1}` } });
    if (!res.ok && res.status !== 206) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Verify an uploaded object really is one of the allowed image formats. On
 * failure, delete the object(s) and return null. Shared by avatars (5.1) and
 * listing images (6.2).
 */
export async function verifyImageObject(
  admin: Admin,
  bucket: string,
  paths: string[],
): Promise<ImageKind | null> {
  for (const path of paths) {
    const head = await readObjectHead(admin, bucket, path, 32);
    const kind = head ? sniffImageType(head) : null;
    if (!kind) {
      // Remove every object in the set — a failed verify keeps nothing.
      await admin.storage.from(bucket).remove(paths).catch(() => {});
      return null;
    }
  }
  const head = await readObjectHead(admin, bucket, paths[0]!, 32);
  return head ? sniffImageType(head) : null;
}
