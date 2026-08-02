import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";

/**
 * Reusable Stripe product/price sync — shared by admin packages (Phase 12) and
 * add-ons (Phase 13). It creates/updates the Product, and treats Prices as
 * IMMUTABLE: when the amount/currency/interval changes, it creates a NEW price,
 * archives the old one, and reports that existing subscribers keep their old
 * price until they resubscribe. It never migrates anyone silently.
 */
export type StripeSyncInput = {
  /** Our row id — stored in Stripe metadata for traceability. */
  id: string;
  kind: "package" | "addon";
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  interval: "one_time" | "month" | "year";
  productId: string | null;
  priceId: string | null;
};

export type StripeSyncResult = {
  productId: string | null;
  priceId: string | null;
  priceChanged: boolean;
  archivedPriceId: string | null;
  /** Human-readable note to show the admin (e.g. price-change warning). */
  warning: string | null;
};

function recurringFor(
  interval: StripeSyncInput["interval"],
): Stripe.PriceCreateParams.Recurring | undefined {
  if (interval === "month") return { interval: "month" };
  if (interval === "year") return { interval: "year" };
  return undefined;
}

/** Does an existing Stripe price already match what we want? */
function priceMatches(price: Stripe.Price, input: StripeSyncInput): boolean {
  if (price.unit_amount !== input.priceCents) return false;
  if ((price.currency ?? "").toLowerCase() !== input.currency.toLowerCase())
    return false;
  const wantRecurring = input.interval === "month" || input.interval === "year";
  const isRecurring = Boolean(price.recurring);
  if (wantRecurring !== isRecurring) return false;
  if (wantRecurring && price.recurring?.interval !== input.interval) return false;
  return true;
}

/**
 * Ensure the Stripe Product + Price for a row match the desired state. Returns
 * the ids to persist plus whether a new price was minted (so the caller can warn
 * the admin). Safe to call on every save.
 */
export async function syncStripeProductPrice(
  input: StripeSyncInput,
): Promise<StripeSyncResult> {
  const stripe = getStripe();
  if (!stripe) {
    return {
      productId: input.productId,
      priceId: input.priceId,
      priceChanged: false,
      archivedPriceId: null,
      warning:
        "Stripe isn't configured in this environment, so no product or price was created. Set STRIPE_SECRET_KEY and use “Sync from Stripe” later.",
    };
  }

  // Free tier — no price needed. Archive any existing price so it can't be bought.
  if (input.priceCents <= 0) {
    let archived: string | null = null;
    if (input.priceId) {
      await stripe.prices.update(input.priceId, { active: false }).catch(() => null);
      archived = input.priceId;
    }
    if (input.productId) {
      await stripe.products
        .update(input.productId, {
          name: input.name,
          description: input.description || undefined,
        })
        .catch(() => null);
    }
    return {
      productId: input.productId,
      priceId: null,
      priceChanged: Boolean(archived),
      archivedPriceId: archived,
      warning: archived
        ? "This tier is now free. Its old Stripe price was archived; existing subscribers keep billing until they cancel."
        : null,
    };
  }

  // Ensure the product.
  let productId = input.productId;
  if (productId) {
    await stripe.products
      .update(productId, {
        name: input.name,
        description: input.description || undefined,
        active: true,
      })
      .catch(() => null);
  } else {
    const product = await stripe.products.create({
      name: input.name,
      description: input.description || undefined,
      metadata: { [`${input.kind}_id`]: input.id },
    });
    productId = product.id;
  }

  // Reuse the existing price if it still matches.
  if (input.priceId) {
    const existing = await stripe.prices.retrieve(input.priceId).catch(() => null);
    if (existing && existing.active && priceMatches(existing, input)) {
      return {
        productId,
        priceId: input.priceId,
        priceChanged: false,
        archivedPriceId: null,
        warning: null,
      };
    }
  }

  // Mint a new price and archive the old one (prices are immutable).
  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: input.priceCents,
    currency: input.currency.toLowerCase(),
    ...(recurringFor(input.interval) ? { recurring: recurringFor(input.interval) } : {}),
    metadata: { [`${input.kind}_id`]: input.id },
  });

  let archivedPriceId: string | null = null;
  if (input.priceId && input.priceId !== newPrice.id) {
    await stripe.prices.update(input.priceId, { active: false }).catch(() => null);
    archivedPriceId = input.priceId;
  }

  return {
    productId,
    priceId: newPrice.id,
    priceChanged: Boolean(archivedPriceId),
    archivedPriceId,
    warning: archivedPriceId
      ? "The price changed, so a new Stripe price was created and the old one archived. Existing subscribers stay on their old price until they cancel and resubscribe — no one was migrated."
      : null,
  };
}

/** Archive a product + its price in Stripe (used when deleting/retiring a tier). */
export async function archiveStripeProduct(
  productId: string | null,
  priceId: string | null,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  if (priceId) await stripe.prices.update(priceId, { active: false }).catch(() => null);
  if (productId)
    await stripe.products.update(productId, { active: false }).catch(() => null);
}

export type DriftReport = {
  ok: boolean;
  messages: string[];
};

/**
 * Reconcile a row against Stripe: report any name/price drift and push the row's
 * name onto the Stripe product (products are mutable). Never changes a price —
 * that's a deliberate action through the normal save flow.
 */
export async function reconcileStripe(input: StripeSyncInput): Promise<DriftReport> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, messages: ["Stripe isn't configured."] };

  const messages: string[] = [];

  if (!input.productId && input.priceCents > 0) {
    messages.push("No Stripe product linked yet — save the tier to create one.");
    return { ok: false, messages };
  }

  if (input.productId) {
    const product = await stripe.products.retrieve(input.productId).catch(() => null);
    if (!product) {
      messages.push(`Stripe product ${input.productId} not found (deleted in Stripe?).`);
    } else if (product.name !== input.name) {
      await stripe.products
        .update(input.productId, { name: input.name })
        .catch(() => null);
      messages.push(
        `Product name drifted (Stripe “${product.name}” → updated to “${input.name}”).`,
      );
    } else {
      messages.push("Product name matches Stripe.");
    }
  }

  if (input.priceId) {
    const price = await stripe.prices.retrieve(input.priceId).catch(() => null);
    if (!price) {
      messages.push(`Stripe price ${input.priceId} not found.`);
    } else if (price.unit_amount !== input.priceCents) {
      messages.push(
        `Price drift: Stripe has ${(price.unit_amount ?? 0) / 100} ${price.currency?.toUpperCase()}, this tier says ${input.priceCents / 100} ${input.currency.toUpperCase()}. Change the price in the form to mint a new Stripe price safely.`,
      );
    } else {
      messages.push("Price matches Stripe.");
    }
  } else if (input.priceCents > 0) {
    messages.push("No Stripe price linked — save the tier to create one.");
  }

  return { ok: true, messages };
}
