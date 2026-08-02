import "server-only";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

export type PricePackage = {
  id: string;
  name: string;
  price_cents: number;
  interval: string;
  currency: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

/**
 * The package's Stripe price id — the source of truth for checkout. Created and
 * persisted on first use from the package's own name/price/interval so a fresh
 * environment can be tested without manually wiring Stripe products.
 */
export async function ensurePackagePrice(
  pkg: PricePackage,
): Promise<string | null> {
  if (pkg.stripe_price_id) return pkg.stripe_price_id;

  const stripe = getStripe();
  if (!stripe || pkg.price_cents <= 0) return null;

  let productId = pkg.stripe_product_id;
  if (!productId) {
    const product = await stripe.products.create({
      name: pkg.name,
      metadata: { package_id: pkg.id },
    });
    productId = product.id;
  }

  const recurring = pkg.interval === "month" || pkg.interval === "year";
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: pkg.price_cents,
    currency: (pkg.currency || "usd").toLowerCase(),
    ...(recurring
      ? { recurring: { interval: pkg.interval === "year" ? "year" : "month" } }
      : {}),
    metadata: { package_id: pkg.id },
  });

  const admin = createAdminClient();
  await admin
    .from("packages")
    .update({ stripe_product_id: productId, stripe_price_id: price.id })
    .eq("id", pkg.id);

  return price.id;
}
