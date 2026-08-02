"use server";

import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { sendTemplateEmail } from "@/lib/email/send";

export type ClaimResult =
  | { ok: true; slug: string; listingUrl: string }
  | { ok: false; error: string };

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

/**
 * Claim the draft created for an existing account and finish publishing it.
 * The signed-in user must own the draft (RLS also enforces this). Idempotent —
 * a draft already claimed just returns its link.
 */
export async function claimDraftAction(draftId: string): Promise<ClaimResult> {
  if (!z.string().uuid().safeParse(draftId).success) {
    return { ok: false, error: "That link is invalid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to finish." };

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, owner_id, status, slug, business_name, contact_name, contact_email, package_id",
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!listing || listing.owner_id !== user.id) {
    return {
      ok: false,
      error: "That listing isn't yours, or the link has expired.",
    };
  }

  const origin = siteOrigin(await headers());
  const listingUrl = `${origin}/listing/${listing.slug}`;

  // Already finished — just hand back the link.
  if (listing.status !== "draft") {
    return { ok: true, slug: listing.slug ?? "", listingUrl };
  }

  const { data: pkg } = await supabase
    .from("packages")
    .select("requires_approval")
    .eq("id", listing.package_id ?? "")
    .maybeSingle();
  const status = pkg && pkg.requires_approval === false ? "published" : "pending_review";
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      status,
      submitted_at: nowIso,
      published_at: status === "published" ? nowIso : null,
    })
    .eq("id", listing.id);
  if (updateError) {
    return { ok: false, error: "We couldn't finish publishing. Please try again." };
  }

  const settings = await getSettings(["review_sla_days"]);
  const reviewDays =
    typeof settings.review_sla_days === "number" ? settings.review_sla_days : 2;
  await sendTemplateEmail("listing_submitted", {
    to: listing.contact_email ?? user.email ?? "",
    userId: user.id,
    listingId: listing.id,
    context: {
      owner_name: listing.contact_name,
      listing_name: listing.business_name,
      listing_path: listingUrl,
      review_days: reviewDays,
    },
  });

  return { ok: true, slug: listing.slug ?? "", listingUrl };
}
