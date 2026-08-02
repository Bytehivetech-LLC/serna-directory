import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email/send";
import { getMapsPublicConfig, getSendgridKey, getRecaptchaSecret } from "@/lib/secrets/resolve";

type Admin = ReturnType<typeof createAdminClient>;
const WEB = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Un-feature listings whose featured_until has passed. */
export async function runFeaturedExpiry(admin: Admin): Promise<{ unfeatured: number }> {
  const { data } = await admin
    .from("listings")
    .update({ is_featured: false, featured_until: null })
    .eq("is_featured", true)
    .not("featured_until", "is", null)
    .lt("featured_until", new Date().toISOString())
    .select("id");
  return { unfeatured: data?.length ?? 0 };
}

/** Email owners 14 days before a listing's expires_at (a one-day window each). */
export async function runListingRenewalReminders(admin: Admin): Promise<{ reminded: number }> {
  const now = Date.now();
  const from = new Date(now + 13 * 86400000).toISOString();
  const to = new Date(now + 14 * 86400000).toISOString();
  const { data } = await admin
    .from("listings")
    .select("id, business_name, slug, contact_name, contact_email, expires_at")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", from)
    .lt("expires_at", to);

  let reminded = 0;
  for (const l of data ?? []) {
    if (!l.contact_email) continue;
    await sendTemplateEmail("listing_expiring", {
      to: l.contact_email,
      listingId: l.id,
      context: {
        owner_name: l.contact_name ?? "there",
        listing_name: l.business_name,
        expires_on: l.expires_at ? l.expires_at.slice(0, 10) : "",
        edit_link: `${WEB}/dashboard/listings/${l.id}/edit`,
      },
    });
    reminded += 1;
  }
  return { reminded };
}

/** Refresh the denormalised categories.listing_count from live published counts. */
export async function runCategoryCounts(admin: Admin): Promise<{ categories: number }> {
  const [{ data: cats }, { data: listings }] = await Promise.all([
    admin.from("categories").select("id"),
    admin.from("listings").select("category_id").eq("status", "published").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const l of listings ?? []) {
    if (l.category_id) counts.set(l.category_id, (counts.get(l.category_id) ?? 0) + 1);
  }
  for (const c of cats ?? []) {
    await admin.from("categories").update({ listing_count: counts.get(c.id) ?? 0 }).eq("id", c.id);
  }
  return { categories: cats?.length ?? 0 };
}

/** Prune rate-limit rows older than a day — they've all reset by then. */
export async function pruneRateLimits(admin: Admin): Promise<{ pruned: number }> {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const { data } = await admin.from("rate_limits").delete().lt("window_start", cutoff).select("bucket");
  return { pruned: data?.length ?? 0 };
}

/**
 * Health-check each configured integration and record the result on its row, so
 * a dead key surfaces in the admin panel before it surfaces as undelivered mail.
 */
export async function runIntegrationHealth(admin: Admin): Promise<{ checked: number }> {
  let checked = 0;

  const mark = async (provider: string, ok: boolean, error?: string) => {
    checked += 1;
    await admin
      .from("integration_settings")
      .update(ok ? { last_success_at: new Date().toISOString(), last_error_message: null } : { last_error_at: new Date().toISOString(), last_error_message: error ?? "health check failed" })
      .eq("provider", provider);
  };

  // Maps — a real geocode is the cheapest honest check.
  const maps = await getMapsPublicConfig();
  if (maps.browserKey) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Phoenix,AZ&key=${encodeURIComponent(maps.browserKey)}`);
      const data = (await res.json()) as { status: string };
      await mark("google_maps", data.status === "OK", data.status);
    } catch {
      await mark("google_maps", false, "network error");
    }
  }

  // SendGrid / reCAPTCHA — presence check (a send/verify would cost a real call).
  if (await getSendgridKey()) await mark("sendgrid", true);
  if (await getRecaptchaSecret()) await mark("recaptcha", true);

  return { checked };
}
