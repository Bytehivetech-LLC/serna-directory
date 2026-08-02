import "server-only";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

export type StripeStatus = {
  configured: boolean;
  mode: "live" | "test" | null;
  accountName: string | null;
  webhook: {
    lastEventAt: string | null;
    lastEventType: string | null;
    /** True when an event was received within the last 7 days. */
    healthy: boolean;
  };
};

/**
 * Connection status for the admin banner: live/test mode, the connected account
 * name, and webhook health from the most recent processed event.
 */
export async function getStripeStatus(): Promise<StripeStatus> {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const configured = Boolean(key);
  const mode = !configured ? null : key.startsWith("sk_live") ? "live" : "test";

  let accountName: string | null = null;
  const stripe = getStripe();
  if (stripe) {
    try {
      // Passing null retrieves the account the key itself belongs to.
      const account = await stripe.accounts.retrieve(null);
      accountName =
        account.business_profile?.name ??
        account.settings?.dashboard?.display_name ??
        account.email ??
        account.id;
    } catch {
      accountName = null;
    }
  }

  const admin = createAdminClient();
  const { data: lastEvent } = await admin
    .from("stripe_events")
    .select("type, processed_at")
    .order("processed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastEventAt = lastEvent?.processed_at ?? null;
  const healthy = lastEventAt
    ? Date.now() - new Date(lastEventAt).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  return {
    configured,
    mode,
    accountName,
    webhook: {
      lastEventAt,
      lastEventType: lastEvent?.type ?? null,
      healthy,
    },
  };
}
