import "server-only";
import Stripe from "stripe";

// Pinned to the version the installed SDK's types are generated for. Never
// expose the secret key to the client (server-only import above).
export const STRIPE_API_VERSION = "2026-07-29.dahlia";

let cached: Stripe | null = null;

/** The configured Stripe SDK instance, or null when payments aren't configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return cached;
}
