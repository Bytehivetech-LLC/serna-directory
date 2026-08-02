"use server";

import { z } from "zod";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { checkRateLimit, minutesUntil } from "@/lib/utils/rate-limit";
import { sendTemplateEmail } from "@/lib/email/send";
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
    await sendTemplateEmail("inquiry_received", {
      to: listing.contact_email,
      listingId: listing.id,
      replyTo: { email, name },
      context: {
        listing_name: listing.business_name,
        enquirer_name: name,
        enquirer_email: email,
        message,
        listing_id: listing.id,
      },
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
