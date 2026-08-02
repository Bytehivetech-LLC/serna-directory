"use client";

import { ImageUploadField, type UploadResult } from "@/components/ui/image-upload-field";
import { processSquareAvatar } from "@/lib/list-form/image-processing";
import { createClient } from "@/lib/supabase/client";
import {
  signAvatarUploadAction,
  confirmAvatarAction,
  removeAvatarAction,
} from "@/lib/dashboard/avatar-actions";

/**
 * Profile-picture upload. Crops to a 512×512 WebP in the browser (EXIF stripped,
 * ≤1MB), uploads to the caller's own avatars/{uid}/ folder via a signed URL,
 * then confirmAvatar() verifies the magic bytes server-side before avatar_url is
 * written. Uses the shared round ImageUploadField.
 */
export function AvatarUpload({ initialUrl }: { initialUrl: string | null }) {
  async function onUpload(file: File): Promise<UploadResult> {
    let blob: Blob;
    try {
      blob = await processSquareAvatar(file);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't process that image." };
    }
    const signed = await signAvatarUploadAction();
    if (!signed.ok) return { ok: false, error: signed.error };

    const supabase = createClient();
    const up = await supabase.storage
      .from("avatars")
      .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: "image/webp" });
    if (up.error) return { ok: false, error: "Upload failed. Please try again." };

    const res = await confirmAvatarAction(signed.path);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, url: res.url };
  }

  async function onRemove() {
    const res = await removeAvatarAction();
    return res.ok ? undefined : ({ ok: false as const, error: res.error });
  }

  return (
    <ImageUploadField
      label="Profile picture"
      round
      value={initialUrl}
      accept={["image/png", "image/jpeg", "image/webp"]}
      maxBytes={10 * 1024 * 1024}
      onUpload={onUpload}
      onRemove={onRemove}
      hint="Square works best. We crop to a circle and shrink it for you."
    />
  );
}
