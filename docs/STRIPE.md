# Stripe integration

How Serna Directory maps its pricing to Stripe, how to change prices safely, and
how to keep webhooks healthy. This covers **packages** (Phase 12); **add-ons**
(Phase 13) use the exact same sync module.

## How our objects map to Stripe

| Serna (Postgres)            | Stripe object            |
| --------------------------- | ------------------------ |
| `packages.name` / `description` | Product `name` / `description` |
| `packages.stripe_product_id`    | Product id (`prod_…`)          |
| `packages.price_cents` + `currency` + `interval` | Price (`price_…`) |
| `packages.stripe_price_id`      | The **current** Price id       |
| `subscriptions.stripe_subscription_id` | Subscription (`sub_…`)  |
| `payments.stripe_payment_intent_id` / `stripe_invoice_id` | PaymentIntent / Invoice |
| `profiles.stripe_customer_id`   | Customer (`cus_…`)             |

One package = one Stripe **Product**. Each distinct price the package has ever had
= one Stripe **Price**. `stripe_price_id` always points at the price we currently
sell; older prices are archived (`active: false`) but never deleted, because
existing subscribers still reference them.

The sync logic lives in **`lib/stripe/sync.ts`** (`syncStripeProductPrice`,
`reconcileStripe`, `archiveStripeProduct`) and is called from the package actions
in `lib/admin/packages-actions.ts`. It is deliberately generic (`kind: "package"
| "addon"`) so Phase 13 reuses it unchanged.

## Creating a package

Admin → **Packages → New package**. On save, if `price_cents > 0` and there is no
`stripe_price_id` yet, we:

1. Create a Stripe **Product** (or update its name/description if one already exists).
2. Create a **Price** for the amount + currency + interval.
3. Store `stripe_product_id` and `stripe_price_id` on the row.

A **free** tier (`price_cents = 0`) never gets a price; if it previously had one,
that price is archived so it can't be purchased.

## Changing a price safely

**Stripe prices are immutable.** You cannot edit the amount of an existing price.
So when you change a package's price (or currency, or interval) and save:

1. A **new** Stripe Price is created for the new amount.
2. `stripe_price_id` is updated to the new price.
3. The **old** price is archived (`active: false`).
4. The admin sees a clear warning:
   > _The price changed, so a new Stripe price was created and the old one
   > archived. Existing subscribers stay on their old price until they cancel and
   > resubscribe — no one was migrated._

**We never migrate subscribers automatically.** Anyone currently subscribed keeps
billing at their original price until they cancel and re-subscribe (which picks up
the new price). If you need to move people onto a new price, do it deliberately in
the Stripe dashboard or the Billing Portal — it is never a side effect of editing
a package here.

### Sync from Stripe

The edit form has a **Sync from Stripe** button (`reconcileStripe`). It:

- Reports whether the product name and price match Stripe.
- Pushes the package **name** onto the Stripe product if it drifted (products are
  mutable).
- **Reports** price drift but never changes a price — resolve that by editing the
  price in the form (which mints a new price as above).

## Deleting vs archiving

- **Delete** is blocked when a package has **active or trialing subscribers** —
  the UI explains this and points you at those subscribers. It's also blocked when
  listings still reference the package (Postgres FK). Archive instead.
- **Archive** sets `is_active = false`, `is_public = false`, clears `is_default`,
  and archives the Stripe product + price. Subscribers keep billing; the tier just
  disappears from the pricing UI.

## Connection status

The top of **Packages** and **Payments** shows a status strip
(`lib/stripe/status.ts`):

- **Mode** — `live` vs `test`, read from the `STRIPE_SECRET_KEY` prefix
  (`sk_live…` / `sk_test…`).
- **Account** — the connected account's display name (`stripe.accounts.retrieve`).
- **Webhook health** — the most recent row in `stripe_events` and when it arrived.
  "Healthy" = an event within the last 7 days.

## Webhooks

The endpoint is **`/api/webhooks/stripe`** (Node runtime, exempt from middleware).
It is the **only writer of paid state** — the app never marks a listing paid or a
subscription active anywhere else.

Flow: verify the signature → **insert into `stripe_events` first** (idempotency; a
duplicate id returns 200 and stops) → handle the event → 200, or 500 to make
Stripe retry. Handled events: `checkout.session.completed`,
`customer.subscription.updated|deleted`, `invoice.paid`,
`invoice.payment_failed`, `charge.refunded`.

### Testing webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, then in another shell:

```bash
stripe trigger checkout.session.completed
```

Or run a real end-to-end test: create a paid package in the admin, buy it with the
`4242 4242 4242 4242` test card, and confirm the listing flips to featured and a
`payments` row appears.

Re-send an event from the Stripe dashboard (Developers → Events → Resend) and
confirm it's **ignored** (the `stripe_events` insert conflicts → 200, no double
processing).

### When a webhook fails

- A handler that throws returns **500**, so Stripe **retries** automatically
  (with backoff, for up to ~3 days).
- Every failure also writes an `audit_log` row (`action:
  "stripe.webhook_failed"`), and the **admin dashboard** shows a "Stripe webhook
  failures this week" alert. Investigate from **Audit log**.
- In the Stripe dashboard, **Developers → Webhooks → your endpoint** shows delivery
  attempts and lets you resend. Because processing is idempotent (keyed on the
  event id), resending is always safe.
- If the signature check fails (400), the secret is wrong — reset
  `STRIPE_WEBHOOK_SECRET` to the endpoint's signing secret.

## Environment variables

| Var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server SDK. `sk_test_…` or `sk_live_…` selects mode. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` for signature verification. |
| `NEXT_PUBLIC_SITE_URL` | Public site origin used in success/cancel URLs and emails. |

Never expose the secret key to the client or via a `NEXT_PUBLIC_` var. The service
role client + Stripe secret are only touched in the webhook, in provisioning, and
in admin actions that have already verified the caller is an admin.

## Add-ons (Phase 13)

Add-ons map to Stripe exactly like packages (`addons.stripe_product_id` /
`stripe_price_id`), through the **same** `lib/stripe/sync.ts` module
(`kind: "addon"`). Safe price changes and archiving work identically.

**Buying.** `createExtrasCheckoutAction` (owner dashboard) and `buildAddonCheckout`
(inside the public listing submit) write `listing_addons` rows as
`pending_payment` keyed to the Checkout session id, then redirect. The webhook
(`checkout.session.completed`, `metadata.purpose = "addons"`) records the payment,
flips the rows to `active`, stamps `starts_at`/`expires_at` (from the add-on's
`duration_days`), and emails an itemised confirmation.

**Mixed intervals.** A Checkout session is either one-time (`payment`) or a single
same-interval subscription. So a selection is allowed when it is *all one-time* or
*all the same recurring interval*; anything mixed is refused with a message asking
the buyer to purchase the groups separately. Running two sequential sessions
(recurring first, then a one-time `payment` session) is the future upgrade path —
it would key both sessions' `listing_addons` to the respective session ids and
show progress in the UI.

**Entitlements.** Buying never grants a perk directly — the webhook activates the
`listing_addons` row and `public.listing_entitlements` sums active rows onto the
package baseline. Everything server-side (image cap, listing-count, badge, etc.)
reads that function and nothing else.

**Expiry.** `GET /api/cron/addons` (Bearer `CRON_SECRET`, run daily) expires
past-due add-ons and emails a one-time 7-day renewal warning.

**Refunds.** A Stripe refund fires `charge.refunded`; the webhook marks the payment
refunded and cascades its `listing_addons` to `refunded`, so the entitlement drops.
Refund from the Stripe dashboard (the fulfilment queue links straight to it).
