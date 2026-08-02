"use server";

import { headers } from "next/headers";
import DOMPurify from "isomorphic-dompurify";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { checkRateLimit, minutesUntil } from "@/lib/utils/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { geocodeAddress } from "@/lib/geo/geocode";
import { getSettings } from "@/lib/settings";
import { sendTemplateEmail } from "@/lib/email/send";
import { sendAdminAlert } from "@/lib/email/admin-alerts";
import { zodErrorToFieldErrors } from "@/lib/forms";
import { getStripe } from "@/lib/stripe/client";
import { listingSubmitSchema, type ListingSubmitInput } from "./submit-schema";

const BUCKET = "listing-images";

export type UploadTarget = {
  fullPath: string;
  fullToken: string;
  thumbPath: string;
  thumbToken: string;
};

export type SubmitResult =
  | {
      ok: true;
      mode: "created" | "signed_in";
      listingId: string;
      slug: string;
      featured: boolean;
      uploads: UploadTarget[];
      /** When add-ons were selected, redirect here to pay for them. */
      checkoutUrl?: string | null;
    }
  | { ok: true; mode: "existing"; redirectTo: string; message: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

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

function descriptionHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return DOMPurify.sanitize(paragraphs, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Build an add-ons checkout for a freshly-created listing (public submit flow).
 * Uses the service-role client — this runs inside the sanctioned "account
 * provisioning during listing submission" path, so the buyer may be a brand-new,
 * not-yet-signed-in account. Writes pending listing_addons keyed to the session;
 * the webhook activates them. Returns the checkout URL, or null when there's
 * nothing to charge / Stripe isn't configured / the selection mixes intervals.
 */
async function buildAddonCheckout(
  admin: AdminClient,
  ownerId: string,
  ownerEmail: string,
  listingId: string,
  listingSlug: string,
  selections: { addonId: string; quantity: number }[],
  origin: string,
): Promise<string | null> {
  if (!selections.length) return null;
  const stripe = getStripe();
  if (!stripe) return null;

  const ids = selections.map((s) => s.addonId);
  const { data: addons } = await admin
    .from("addons")
    .select("id, price_cents, interval, stripe_price_id, is_active, is_public, max_quantity")
    .in("id", ids);
  const byId = new Map((addons ?? []).map((a) => [a.id, a]));

  const items: { addon: NonNullable<ReturnType<typeof byId.get>>; quantity: number }[] = [];
  for (const s of selections) {
    const a = byId.get(s.addonId);
    if (!a || !a.is_active || !a.is_public || a.price_cents <= 0 || !a.stripe_price_id) continue;
    items.push({ addon: a, quantity: Math.min(s.quantity, a.max_quantity) });
  }
  if (!items.length) return null;

  const intervals = new Set(items.map((i) => i.addon.interval));
  const allOneTime = intervals.size === 1 && intervals.has("one_time");
  const allSameRecurring = intervals.size === 1 && !intervals.has("one_time");
  if (!allOneTime && !allSameRecurring) return null; // mixed → buy from dashboard
  const mode = allOneTime ? "payment" : "subscription";

  // Ensure a Stripe customer for the (possibly brand-new) owner.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", ownerId)
    .maybeSingle();
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ownerEmail,
      name: profile?.full_name ?? undefined,
      metadata: { user_id: ownerId },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", ownerId);
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    client_reference_id: ownerId,
    line_items: items.map((i) => ({ price: i.addon.stripe_price_id!, quantity: i.quantity })),
    metadata: { purpose: "addons", listing_id: listingId, user_id: ownerId },
    ...(mode === "subscription"
      ? { subscription_data: { metadata: { purpose: "addons", listing_id: listingId, user_id: ownerId } } }
      : {}),
    success_url: `${origin}/listing/${listingSlug}?extras=success`,
    cancel_url: `${origin}/listing/${listingSlug}`,
  });
  if (!session.url) return null;

  await admin.from("listing_addons").insert(
    items.map((i) => ({
      listing_id: listingId,
      addon_id: i.addon.id,
      owner_id: ownerId,
      quantity: i.quantity,
      status: "pending_payment",
      amount_cents: i.addon.price_cents * i.quantity,
      stripe_checkout_id: session.id,
    })),
  );

  return session.url;
}

export async function submitListingAction(
  input: ListingSubmitInput,
): Promise<SubmitResult> {
  const parsed = listingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodErrorToFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = clientIp(h);
  const origin = siteOrigin(h);

  const limit = await checkRateLimit(`listing-submit:ip:${ip}`, 5, 60 * 60);
  if (!limit.allowed) {
    const mins = minutesUntil(limit.resetAt);
    return {
      ok: false,
      error: `You've submitted a few listings already. Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  const captcha = await verifyRecaptcha(data.recaptchaToken, "list_program");
  if (!captcha.ok) {
    return { ok: false, error: captcha.reason ?? "Verification failed." };
  }

  const admin = createAdminClient();

  const [{ data: category }, { data: pkg }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle(),
    admin
      .from("packages")
      .select("id, allows_featured, requires_approval, price_cents")
      .eq("slug", data.packageSlug)
      .maybeSingle(),
  ]);
  if (!category || !pkg) {
    return { ok: false, error: "That category or plan is no longer available." };
  }

  const email = data.core.contact_email;

  // ---- Account branch -----------------------------------------------------
  // Signed in → theirs. Existing account (not signed in) → draft to claim after
  // login. New email → provision a passwordless account + magic link.
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  let ownerId: string;
  let mode: "created" | "signed_in" | "existing";
  let newAccount = false;

  if (currentUser) {
    ownerId = currentUser.id;
    mode = "signed_in";
  } else {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      ownerId = existing.id;
      mode = "existing";
    } else {
      const { data: created } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: data.core.contact_name },
      });
      if (!created?.user) {
        return { ok: false, error: "We couldn't set up your account. Please try again." };
      }
      ownerId = created.user.id;
      newAccount = true;
      mode = "created";
      await admin.from("profiles").upsert({
        id: ownerId,
        email,
        full_name: data.core.contact_name,
        role: "user",
        onboarding_complete: false,
      });
    }
  }

  // ---- Coordinates --------------------------------------------------------
  let latitude = data.geo?.latitude ?? null;
  let longitude = data.geo?.longitude ?? null;
  let googlePlaceId = data.geo?.google_place_id ?? null;
  if (latitude == null && (data.core.address_line || data.core.city)) {
    const g = await geocodeAddress({
      address_line: data.core.address_line,
      city: data.core.city,
      state: data.core.state,
      postal_code: data.core.postal_code,
    });
    if (g) {
      latitude = g.lat;
      longitude = g.lng;
      googlePlaceId = googlePlaceId ?? g.placeId;
    }
  }

  // Existing-account drafts wait to be claimed; everyone else goes to review
  // (or straight to published when the package doesn't require approval).
  const status =
    mode === "existing"
      ? "draft"
      : pkg.requires_approval
        ? "pending_review"
        : "published";

  const slug = `${slugify(data.core.business_name) || "listing"}-${crypto.randomUUID().slice(0, 6)}`;
  const alsoServes = (data.core.also_serves ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const nowIso = new Date().toISOString();

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .insert({
      owner_id: ownerId,
      category_id: category.id,
      package_id: pkg.id,
      status,
      slug,
      business_name: data.core.business_name,
      contact_name: data.core.contact_name,
      contact_email: email,
      contact_phone: data.core.contact_phone ?? null,
      show_phone: data.showPhone,
      website: data.core.website ?? null,
      description: data.core.description,
      description_html: descriptionHtml(data.core.description),
      address_line: data.core.address_line ?? null,
      city: data.core.city ?? null,
      state: data.core.state ?? null,
      postal_code: data.core.postal_code ?? null,
      country: "US",
      also_serves: alsoServes,
      ages_served: data.core.ages_served ?? null,
      rate_text: data.core.rate_text ?? null,
      accepts_esa: data.core.accepts_esa,
      latitude,
      longitude,
      google_place_id: googlePlaceId,
      custom_fields: data.customFields,
      submitted_at: mode === "existing" ? null : nowIso,
      published_at: status === "published" ? nowIso : null,
    })
    .select("id, slug")
    .single();
  if (listingError || !listing) {
    return { ok: false, error: "We couldn't create your listing. Please try again." };
  }

  // Tags (all modes).
  if (data.tagSlugs.length) {
    const { data: tags } = await admin
      .from("tags")
      .select("id")
      .in("slug", data.tagSlugs);
    if (tags?.length) {
      await admin
        .from("listing_tags")
        .insert(tags.map((t) => ({ listing_id: listing.id, tag_id: t.id })));
    }
  }

  // Existing account → hand off to /login → /finish (photos re-added there).
  if (mode === "existing") {
    const next = `/list-a-program/finish?draft=${listing.id}`;
    return {
      ok: true,
      mode: "existing",
      redirectTo: `/login?next=${encodeURIComponent(next)}`,
      message:
        "You already have an account — sign in and we'll finish publishing.",
    };
  }

  // ---- Images: allowance from entitlements, then signed upload URLs --------
  let maxImages = 8;
  const { data: ent } = await admin.rpc("listing_entitlements", {
    p_listing_id: listing.id,
  });
  const entRow = Array.isArray(ent) ? ent[0] : ent;
  if (entRow && typeof (entRow as { max_images?: number }).max_images === "number") {
    maxImages = (entRow as { max_images: number }).max_images;
  }

  const uploads: UploadTarget[] = [];
  const count = Math.min(data.imageCount, maxImages);
  for (let i = 0; i < count; i++) {
    const uuid = crypto.randomUUID();
    const fullPath = `${listing.id}/${uuid}.webp`;
    const thumbPath = `${listing.id}/${uuid}_thumb.webp`;
    const [full, thumb] = await Promise.all([
      admin.storage.from(BUCKET).createSignedUploadUrl(fullPath),
      admin.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (!full.data || !thumb.data) continue;
    uploads.push({
      fullPath,
      fullToken: full.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    });
    await admin.from("listing_images").insert({
      listing_id: listing.id,
      storage_path: fullPath,
      thumb_path: thumbPath,
      is_cover: i === 0,
      sort_order: i,
      alt_text: data.core.business_name,
    });
  }

  // ---- Transactional email ------------------------------------------------
  const settings = await getSettings(["review_sla_days"]);
  const reviewDays =
    typeof settings.review_sla_days === "number" ? settings.review_sla_days : 2;
  const listingPath = `${origin}/listing/${listing.slug}`;

  if (newAccount) {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard/profile?welcome=1")}`,
      },
    });
    await sendTemplateEmail("complete_profile", {
      to: email,
      userId: ownerId,
      listingId: listing.id,
      context: {
        owner_name: data.core.contact_name,
        magic_link: link?.properties?.action_link ?? `${origin}/login`,
      },
    });
  }

  await sendTemplateEmail("listing_submitted", {
    to: email,
    userId: ownerId,
    listingId: listing.id,
    context: {
      owner_name: data.core.contact_name,
      listing_name: data.core.business_name,
      listing_path: listingPath,
      review_days: reviewDays,
    },
  });

  // Alert the team when something lands in the review queue.
  if (status === "pending_review") {
    await sendAdminAlert("admin_listing_pending", {
      owner_name: data.core.contact_name,
      listing_name: data.core.business_name,
    });
  }

  // Add-ons: create a checkout to pay for any selected extras.
  const checkoutUrl = await buildAddonCheckout(
    admin,
    ownerId,
    email,
    listing.id,
    listing.slug ?? slug,
    data.addons,
    origin,
  );

  return {
    ok: true,
    mode,
    listingId: listing.id,
    slug: listing.slug ?? slug,
    featured: pkg.price_cents > 0 && pkg.allows_featured,
    uploads,
    checkoutUrl,
  };
}
