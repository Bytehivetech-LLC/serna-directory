"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { enqueueAssetDeletion, pathFromPublicUrl } from "@/lib/assets/lifecycle";
import { verifyImageObject } from "@/lib/assets/magic-bytes";

const AVATARS_BUCKET = "avatars";

/**
 * Sign a scoped upload URL for the caller's own avatar folder. The storage RLS
 * policy already restricts writes to `avatars/{user_id}/…`; we also assert the
 * path here so a signed URL can never point outside the caller's folder.
 */
export async function signAvatarUploadAction(): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  const user = await requireUser();
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(AVATARS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't prepare the upload." };
  return { ok: true, path, token: data.token };
}

/**
 * After the browser uploads to the signed URL, verify the bytes really are an
 * image (magic bytes, Range read), enqueue the OLD avatar for deletion, then
 * write avatar_url. On a bad file the object is deleted and no URL is written.
 */
export async function confirmAvatarAction(
  objectPath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await requireUser();

  // The path must be inside the caller's own folder.
  if (!objectPath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "That upload path isn't yours." };
  }

  const admin = createAdminClient();
  const kind = await verifyImageObject(admin, AVATARS_BUCKET, [objectPath]);
  if (!kind) {
    return { ok: false, error: "That file isn't a valid image. Nothing was saved." };
  }

  // Enqueue the previous avatar (never delete storage directly).
  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const oldPath = pathFromPublicUrl(prev?.avatar_url ?? null, AVATARS_BUCKET);
  if (oldPath && oldPath !== objectPath) {
    await enqueueAssetDeletion(admin, AVATARS_BUCKET, oldPath, "replaced:avatar");
  }

  const publicUrl = admin.storage.from(AVATARS_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your picture." };

  await logAudit({ action: "profile.avatar_set", entityType: "user", entityId: user.id });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard", "layout");
  return { ok: true, url: publicUrl };
}

export async function removeAvatarAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const oldPath = pathFromPublicUrl(prev?.avatar_url ?? null, AVATARS_BUCKET);
  if (oldPath) await enqueueAssetDeletion(admin, AVATARS_BUCKET, oldPath, "removed:avatar");

  const { error } = await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't remove your picture." };

  await logAudit({ action: "profile.avatar_remove", entityType: "user", entityId: user.id });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
