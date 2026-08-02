"use server";

import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin, getSession, requireRecentMFA } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/sendgrid";
import { sendTemplateEmail } from "@/lib/email/send";
import { enqueueAssetDeletion, pathFromPublicUrl } from "@/lib/assets/lifecycle";
import { hasActivePaidListings } from "./queries";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const idsSchema = z.array(z.string().uuid()).min(1).max(500);
const idSchema = z.string().uuid();

function siteOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return siteUrl();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------ bulk verify -- */

export async function verifyUsersAction(
  ids: string[],
  value: boolean,
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No users selected." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_verified: value })
    .in("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't update those users." };

  await logAudit({
    action: value ? "user.verify" : "user.unverify",
    entityType: "user",
    entityId: parsed.data.length === 1 ? parsed.data[0] : null,
    meta: { count: parsed.data.length, ids: parsed.data },
  });
  revalidatePath("/admin/users");
  if (parsed.data.length === 1) revalidatePath(`/admin/users/${parsed.data[0]}`);
  return {
    ok: true,
    message: `${parsed.data.length} ${parsed.data.length === 1 ? "user" : "users"} ${value ? "verified" : "unverified"}.`,
  };
}

/* ----------------------------------------------------------- bulk suspend -- */

export async function suspendUsersAction(
  ids: string[],
  value: boolean,
  reason?: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No users selected." };

  const session = await getSession();
  const selfId = session?.user?.id;

  // An admin can never suspend their own account.
  let targets = parsed.data;
  const triedSelf = value && selfId ? parsed.data.includes(selfId) : false;
  if (value && selfId) targets = targets.filter((id) => id !== selfId);
  if (targets.length === 0) {
    return { ok: false, error: "You can't suspend your own account." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_suspended: value })
    .in("id", targets);
  if (error) return { ok: false, error: "Couldn't update those users." };

  await logAudit({
    action: value ? "user.suspend" : "user.unsuspend",
    entityType: "user",
    entityId: targets.length === 1 ? targets[0] : null,
    meta: {
      count: targets.length,
      ids: targets,
      ...(reason ? { reason } : {}),
    },
  });
  revalidatePath("/admin/users");
  if (targets.length === 1) revalidatePath(`/admin/users/${targets[0]}`);

  const base = `${targets.length} ${targets.length === 1 ? "user" : "users"} ${value ? "suspended" : "unsuspended"}.`;
  return {
    ok: true,
    message: triedSelf ? `${base} (Your own account was skipped.)` : base,
  };
}

/* ------------------------------------------------------------ change role -- */

const roleSchema = z.enum(["user", "moderator", "admin"]);

export async function changeUserRoleAction(
  id: string,
  role: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const idOk = idSchema.safeParse(id);
  const roleOk = roleSchema.safeParse(role);
  if (!idOk.success || !roleOk.success) {
    return { ok: false, error: "Invalid role change." };
  }

  const session = await getSession();
  if (session?.user?.id === id && roleOk.data !== "admin") {
    return { ok: false, error: "You can't remove your own admin access." };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That user no longer exists." };

  const { error } = await admin
    .from("profiles")
    .update({ role: roleOk.data })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't change that role." };

  // Mirror onto the auth user so the JWT claim reflects the new role promptly.
  await admin.auth.admin.updateUserById(id, {
    app_metadata: { user_role: roleOk.data },
  });

  await logAudit({
    action: "user.role_change",
    entityType: "user",
    entityId: id,
    before: { role: before.role },
    after: { role: roleOk.data },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: `Role changed to ${roleOk.data}.` };
}

/* -------------------------------------------------------- password reset -- */

export async function sendPasswordResetAction(
  id: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid user." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!profile?.email) return { ok: false, error: "That user has no email." };

  const origin = siteOrigin(await headers());
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return { ok: false, error: "Couldn't send the reset email." };
  }

  await logAudit({
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
    meta: { email: profile.email },
  });
  return { ok: true, message: "Password reset email sent." };
}

/* ------------------------------------------------------------ email user -- */

const emailSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(200),
  body: z.string().trim().min(1, "Write a message.").max(5000),
});

export async function emailUserAction(
  id: string,
  input: { subject: string; body: string },
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid user." };
  }
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the message.",
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!profile?.email) return { ok: false, error: "That user has no email." };

  const bodyHtml = escapeHtml(parsed.data.body).replace(/\n/g, "<br>");
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#201f3a">${
    profile.full_name ? `<p>Hi ${escapeHtml(profile.full_name)},</p>` : ""
  }<p>${bodyHtml}</p><p style="margin-top:24px;color:#6e6c8a">— Serna Educational Services</p></div>`;

  const result = await sendEmail({
    to: profile.email,
    subject: parsed.data.subject,
    html,
    text: parsed.data.body,
  });

  // Record in email_log (subject/status only — never the body).
  await admin.from("email_log").insert({
    template_key: "admin_message",
    to_email: profile.email,
    subject: parsed.data.subject,
    user_id: id,
    status: result.status,
    provider_id: result.providerId ?? null,
    error_message: result.error ?? null,
  });

  await logAudit({
    action: "user.email",
    entityType: "user",
    entityId: id,
    meta: { subject: parsed.data.subject, delivery: result.status },
  });

  if (result.status === "failed") {
    return { ok: false, error: "The email couldn't be sent." };
  }
  return {
    ok: true,
    message:
      result.status === "skipped"
        ? "Email queued (mail isn't configured in this environment)."
        : "Email sent.",
  };
}

/* --------------------------------------------------------- edit profile --- */

const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  business_address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function updateUserProfileAction(
  id: string,
  input: z.infer<typeof profileSchema>,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid user." };
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the fields and try again." };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("profiles")
    .select("full_name, phone, business_address, notes")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That user no longer exists." };

  const patch = {
    full_name: parsed.data.full_name ?? null,
    phone: parsed.data.phone ?? null,
    business_address: parsed.data.business_address ?? null,
    notes: parsed.data.notes ?? null,
  };
  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save those changes." };

  await logAudit({
    action: "user.update",
    entityType: "user",
    entityId: id,
    before,
    after: patch,
  });
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: "Profile updated." };
}

/* ------------------------------------------------------------ soft delete -- */

export async function softDeleteUserAction(
  id: string,
  confirm: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid user." };
  }
  if (confirm !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const session = await getSession();
  if (session?.user?.id === id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  if (await hasActivePaidListings(id)) {
    return {
      ok: false,
      error:
        "This user has active paid listings. Cancel or transfer those listings before deleting the account.",
    };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("profiles")
    .select("email, is_suspended, deleted_at, avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "That user no longer exists." };
  if (before.deleted_at) {
    return { ok: false, error: "That account is already deleted." };
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: nowIso, is_suspended: true })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete that account." };

  // Queue their avatar for removal.
  const avatarPath = pathFromPublicUrl(before.avatar_url, "avatars");
  if (avatarPath) await enqueueAssetDeletion(admin, "avatars", avatarPath, "user_deleted");

  await logAudit({
    action: "user.delete",
    entityType: "user",
    entityId: id,
    before: { deleted_at: null, is_suspended: before.is_suspended },
    after: { deleted_at: nowIso, is_suspended: true },
    meta: { email: before.email },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "Account deleted." };
}

/* ------------------------------------------------------------ create user -- */

const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(200),
  role: roleSchema,
  verified: z.boolean().default(false),
  method: z.enum(["invite", "password"]),
  tempPassword: z.string().min(10, "Use at least 10 characters.").max(200).optional(),
});

export type CreateUserResult =
  | { ok: true; userId: string; tempPassword?: string; message: string }
  | { ok: false; error: string; existingUserId?: string; mfaRequired?: boolean };

export async function createUserAction(input: unknown): Promise<CreateUserResult> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;

  // Handing out admin/moderator is at least as sensitive as writing a secret.
  if (d.role === "admin" || d.role === "moderator") {
    const mfa = await requireRecentMFA();
    if (!mfa.ok) {
      return { ok: false, error: "Confirm it's you with your 2FA code, then try again.", mfaRequired: true };
    }
  }
  if (d.method === "password" && !d.tempPassword) {
    return { ok: false, error: "Set a temporary password, or switch to sending an invite." };
  }

  const admin = createAdminClient();

  // Existing email → clear message + a link to that user.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", d.email)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "A user with that email already exists.", existingUserId: existing.id };
  }

  const origin = siteOrigin(await headers());

  // Create the auth user. handle_new_user creates the profile row.
  const { data: created, error: createErr } =
    d.method === "password"
      ? await admin.auth.admin.createUser({
          email: d.email,
          password: d.tempPassword,
          email_confirm: true,
          user_metadata: { full_name: d.fullName, must_change_password: true },
        })
      : await admin.auth.admin.createUser({
          email: d.email,
          email_confirm: false,
          user_metadata: { full_name: d.fullName },
        });
  if (createErr || !created?.user) {
    return { ok: false, error: createErr?.message ?? "Couldn't create that user." };
  }
  const userId = created.user.id;

  // Role + verification (Blocker 2's trigger fix lets these service-role writes
  // stick), and mirror the role onto the JWT claim.
  await admin
    .from("profiles")
    .update({ role: d.role, is_verified: d.verified, full_name: d.fullName })
    .eq("id", userId);
  await admin.auth.admin.updateUserById(userId, { app_metadata: { user_role: d.role } });

  await logAudit({
    action: "user.create",
    entityType: "user",
    entityId: userId,
    after: { email: d.email, role: d.role, method: d.method, verified: d.verified },
  });

  // Invite path: magic link via the existing complete_profile template.
  if (d.method === "invite") {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: d.email,
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard/profile?welcome=1")}` },
    });
    await sendTemplateEmail("complete_profile", {
      to: d.email,
      userId,
      context: {
        owner_name: d.fullName,
        magic_link: link?.properties?.action_link ?? `${origin}/login`,
      },
    });
  }

  // Tell a newly-created admin they have access.
  if (d.role === "admin") {
    await sendTemplateEmail("welcome_admin", {
      to: d.email,
      userId,
      context: { owner_name: d.fullName, admin_url: `${origin}/admin` },
    });
  }

  revalidatePath("/admin/users");
  return {
    ok: true,
    userId,
    tempPassword: d.method === "password" ? d.tempPassword : undefined,
    message:
      d.method === "password"
        ? "User created. Share the temporary password below — they'll be asked to change it."
        : "User created and an invitation email is on its way.",
  };
}
