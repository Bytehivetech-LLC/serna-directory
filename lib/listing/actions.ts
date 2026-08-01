"use server";

import { z } from "zod";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { checkRateLimit, minutesUntil } from "@/lib/utils/rate-limit";
import { sendEmail } from "@/lib/email/sendgrid";
import { buildInquiryEmail } from "@/lib/email/templates/inquiry-notification";
import { inquiryCreateSchema } from "@/lib/validation/schemas";
import {
  type FormState,
  zodErrorToFieldErrors,
} from "@/lib/forms";

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
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/* --------------------------------------------------------- inquiry ------- */

export async function submitInquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = inquiryCreateSchema.safeParse({
    listingId: formData.get("listingId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
    recaptchaToken: formData.get("recaptchaToken") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const { listingId, name, email, phone, message, recaptchaToken } =
    parsed.data;

  const h = await headers();
  const ip = clientIp(h);

  const limit = await checkRateLimit(`inquiry:ip:${ip}`, 5, 10 * 60);
  if (!limit.allowed) {
    const mins = minutesUntil(limit.resetAt);
    return {
      ok: false,
      error: `You've sent a few messages already. Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  const captcha = await verifyRecaptcha(recaptchaToken, "inquiry");
  if (!captcha.ok) {
    return { ok: false, error: captcha.reason ?? "Verification failed." };
  }

  const supabase = await createClient();

  // Only visible/published listings accept inquiries (RLS gates this too).
  const { data: listing } = await supabase
    .from("listings")
    .select("id, business_name, slug, contact_email, status")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "published") {
    return {
      ok: false,
      error: "This listing isn't accepting messages right now.",
    };
  }

  // RLS blocks anon inserts on inquiries — go through the SECURITY DEFINER RPC.
  const { error: insertError } = await supabase.rpc("create_inquiry", {
    p_listing_id: listing.id,
    p_name: name,
    p_email: email,
    p_message: message,
    p_phone: phone ?? null,
    p_ip: ip !== "unknown" ? ip : null,
    p_user_agent: h.get("user-agent") ?? null,
  });
  if (insertError) {
    return {
      ok: false,
      error: "We couldn't send your message. Please try again.",
    };
  }

  // Best-effort owner notification — the inquiry is already saved.
  if (listing.contact_email) {
    const { subject, html, text } = buildInquiryEmail({
      businessName: listing.business_name,
      listingUrl: `${siteOrigin(h)}/listing/${listing.slug}`,
      name,
      email,
      phone,
      message,
    });
    await sendEmail({
      to: listing.contact_email,
      subject,
      html,
      text,
      replyTo: { email, name },
    });
  }

  return {
    ok: true,
    message:
      "Thanks! Your message has been sent — the business will reply to your email.",
  };
}

/* ------------------------------------------------- view counter ---------- */

const uuid = z.string().uuid();

/**
 * Fire-and-forget view increment, deduped per browser session via a cookie.
 * Errors are swallowed — a missed view count must never affect the page.
 */
export async function incrementViewAction(listingId: string): Promise<void> {
  try {
    if (!uuid.safeParse(listingId).success) return;
    const cookieStore = await cookies();
    const key = `v${listingId.replace(/-/g, "")}`;
    if (cookieStore.get(key)) return;

    const supabase = await createClient();
    await supabase.rpc("increment_listing_view", { p_listing_id: listingId });

    // Session cookie (no maxAge) — dedupes for this browser session.
    cookieStore.set(key, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  } catch {
    // fire-and-forget
  }
}
