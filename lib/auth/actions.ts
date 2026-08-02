"use server";

import { headers } from "next/headers";
import { siteUrl } from "@/lib/site-url";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { roleFromAccessToken } from "@/lib/auth/guards";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { checkRateLimit, minutesUntil } from "@/lib/utils/rate-limit";
import {
  type FormState,
  safeNext,
  zodErrorToFieldErrors,
} from "@/lib/forms";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaVerifySchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/schemas";

const APP_TARGET = process.env.APP_TARGET === "admin" ? "admin" : "web";
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

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

/* ------------------------------------------------------------- sign in --- */

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    recaptchaToken: formData.get("recaptchaToken") || undefined,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const { email, password, recaptchaToken, next } = parsed.data;

  const h = await headers();
  const ip = clientIp(h);

  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS),
    checkRateLimit(`login:email:${email}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    const resetAt = !byIp.allowed ? byIp.resetAt : byEmail.resetAt;
    const mins = minutesUntil(resetAt);
    return {
      ok: false,
      error: `Too many attempts. Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  // reCAPTCHA on sign-in (in addition to the IP + email rate limits). On a failed
  // score return the SAME generic message as a wrong password, so the response
  // never tells an attacker which check they tripped.
  const genericAuthError =
    "That email or password isn't right. Try again, or reset your password.";
  const captcha = await verifyRecaptcha(recaptchaToken, "login");
  if (!captcha.ok) {
    return { ok: false, error: genericAuthError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    return {
      ok: false,
      error:
        "That email or password isn't right. Try again, or reset your password.",
    };
  }

  // On the admin surface, only staff may sign in.
  if (APP_TARGET === "admin") {
    const role = roleFromAccessToken(data.session.access_token);
    if (role !== "admin" && role !== "moderator") {
      await supabase.auth.signOut();
      return { ok: false, error: "This account doesn't have admin access." };
    }
  }

  redirect(safeNext(next, APP_TARGET === "admin" ? "/admin" : "/dashboard"));
}

/* ------------------------------------------------------------- sign up --- */

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
    recaptchaToken: formData.get("recaptchaToken") || undefined,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const { fullName, email, password, recaptchaToken, next } = parsed.data;

  const h = await headers();
  const ip = clientIp(h);
  const rl = await checkRateLimit(`register:ip:${ip}`, 5, 15 * 60);
  if (!rl.allowed) {
    const mins = minutesUntil(rl.resetAt);
    return { ok: false, error: `Too many sign-up attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  const captcha = await verifyRecaptcha(recaptchaToken, "register");
  if (!captcha.ok) {
    return { ok: false, error: captcha.reason ?? "Verification failed." };
  }

  const origin = siteOrigin(h);
  const nextPath = safeNext(next, "/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });
  if (error) {
    return {
      ok: false,
      error: "We couldn't create your account. Please try again.",
    };
  }

  // Email confirmation disabled in Supabase → already signed in.
  if (data.session) {
    redirect("/dashboard/profile?welcome=1");
  }

  return {
    ok: true,
    message:
      "Almost there — check your email to confirm your account, then you're in.",
  };
}

/* ------------------------------------------------------------ sign out --- */

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/* -------------------------------------------------- password: forgot ----- */

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const { email } = parsed.data;

  const h = await headers();
  const limit = await checkRateLimit(`pwreset:ip:${clientIp(h)}`, 5, 15 * 60);
  if (limit.allowed) {
    const origin = siteOrigin(h);
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }

  // Same response whether or not the email exists — never reveal account state.
  return {
    ok: true,
    message: "If that email has an account, we've sent a reset link.",
  };
}

/* --------------------------------------------------- password: reset ----- */

export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error:
        "Your reset link has expired. Request a new one from the forgot-password page.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "We couldn't update your password. Try again." };
  }

  redirect("/dashboard?reset=1");
}

/* ---------------------------------------------------- profile update ----- */

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/profile");

  const parsed = profileUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    businessAddress: formData.get("businessAddress"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const { fullName, phone, businessAddress } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone ?? null,
      business_address: businessAddress ?? null,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return { ok: false, error: "We couldn't save your profile. Please try again." };
  }

  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Profile saved." };
}

/* --------------------------------------------------- change password ----- */

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/profile");

  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) {
    return { ok: false, error: "We couldn't change your password. Please try again." };
  }

  return { ok: true, message: "Password updated." };
}

/* ------------------------------------------------------------- MFA ------- */

export type EnrollResult = {
  ok: boolean;
  error?: string;
  factorId?: string;
  qr?: string;
  secret?: string;
};

export async function enrollTotpAction(): Promise<EnrollResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  // Clear any half-finished enrolment so a retry always works.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const stale = factors?.all?.find(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  );
  if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${Date.now()}`,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't start 2FA setup." };
  }
  return {
    ok: true,
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTotpAction(
  factorId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = mfaVerifySchema.safeParse({ factorId, code });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) {
    return {
      ok: false,
      error:
        "That code didn't match. Check your authenticator app and try again.",
    };
  }

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function unenrollTotpAction(
  factorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { ok: false, error: "Couldn't remove 2FA. Please try again." };
  }
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
