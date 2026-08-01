# Serna Directory

Paid listing directory for Arizona homeschool and education businesses.
Read this file at the start of every session.

## Domains

- Public site: `directory.sernaeducationalservices.com` (Vercel project WEB, `APP_TARGET=web`)
- Admin: `admin.sernaeducationalservices.com` (Vercel project ADMIN, `APP_TARGET=admin`)
- Apex `sernaeducationalservices.com` is an existing separate marketing site. This project does not touch it.

## Stack

Next.js 15 App Router + TypeScript (strict) · Tailwind CSS · shadcn/ui ·
Supabase (Postgres + Auth + Storage) · Stripe Checkout & Billing Portal ·
SendGrid · Google Maps JS + Places + Geocoding · reCAPTCHA v3 · Vercel · Cloudflare.

## Architecture

One repo, two Vercel deployments. `APP_TARGET` is `web` or `admin`.
Public site and owner dashboard live under `app/(web)`. Admin lives under
`app/(admin)/admin`. `middleware.ts` hard-404s admin routes when
`APP_TARGET=web`, and public routes when `APP_TARGET=admin`.

## Database

Already created in Supabase — see `docs/02-DATABASE-SCHEMA.sql`.

Tables: profiles, categories, tag_groups, tags, packages, addons, listings,
listing_tags, listing_images, listing_addons, subscriptions, payments,
stripe_events, form_sections, form_fields, site_settings, menu_items,
integration_settings, site_scripts, inquiries, email_templates,
email_template_versions, email_log, asset_deletion_queue, audit_log, rate_limits.

RLS is enabled on every table. Roles come from a `user_role` JWT claim set by a
Supabase auth hook — check with `public.is_admin()` / `public.is_staff()` in SQL,
and from the session JWT in TypeScript.

Key functions:
- `public.search_listings(...)` — the directory query
- `public.listing_entitlements(listing_id)` — the ONLY source of truth for limits
  and perks (image count, listing count, featured, video, badges). Never
  recompute a limit anywhere else.

Storage buckets: `listing-images` (owner-write), `site-assets` (admin-write),
`avatars` (own-folder write).

Deleting a row in `storage.objects` does NOT remove the file. All deletions go
through `asset_deletion_queue` — a trigger enqueues them, a cron worker drains
them via the Storage API. Never delete storage objects any other way.

Email subject and body come from `email_templates`. The HTML shell is code and
follows the site theme. Admins edit words, never layout or HTML.

## Design tokens

Colours are runtime CSS variables read from the `theme` row in `site_settings`
and emitted as space-separated RGB channels on `:root`. Tailwind maps named
colours through `rgb(var(--c-x) / <alpha-value>)`. Never hardcode hex.

Defaults:
```
ink #201f3a · muted #6e6c8a · faint #a4a2bf
indigo #2e2e8f · indigo-deep #232268 · violet #6c4ce8 · violet-soft #efeafd
bg #f7f6fd · card #ffffff · border #e7e5f4 · border-strong #d5d2ec
good #1a8f5c · good-soft #dcf3e8 · warm #fff8f0 · warm-border #f4dfc0
radius 16px · display "Bricolage Grotesque" 700/800 · body "Inter"
```

Violet = selection and focus. Indigo = committed actions. Green = confirmation
only. The admin can change what those colours are, not what they mean.

## Rules

- Server Components by default. `'use client'` only where interactivity requires it.
- Every mutation is a Server Action or Route Handler that re-validates with Zod.
  Never trust the browser.
- `SUPABASE_SERVICE_ROLE_KEY` is used in exactly three places: the Stripe webhook,
  account provisioning during listing submission, and admin actions that have
  already verified the caller is an admin. Never in a Client Component, never in a
  `NEXT_PUBLIC_` var.
- Never ask me to paste a secret into chat. Read `process.env`.
- Responsive to 360px. Visible keyboard focus. `prefers-reduced-motion` respected.
  Real labels on every input.
- Errors say what happened and what to do next. Empty states invite an action.
- Explain what you changed in plain language at the end of each phase.

## Autonomy

Run commands yourself rather than handing them to me. `gh`, `vercel`, `supabase`
and `stripe` CLIs are authenticated, plus `git` and `npm`.

Do without asking: git add/commit/push and branching, npm install/run,
`tsc --noEmit`, `supabase gen types`, `supabase migration new`,
`vercel deploy` (preview), `vercel logs`, and fixing anything those surface.

Ask me first for: `vercel --prod`, anything that deletes database rows, key
rotation, and any Stripe live-mode operation.

Work on a branch named `phase-N-short-name` and open a PR describing what changed
and what I should test. At the end of every phase run `tsc --noEmit` and
`npm run build`, fix what breaks, commit, push, and give me the preview URL. Do
not tell me a phase is done until the build passes.

Never read `.env.local` or `keys.txt`.

## Current state

- Phases complete: **1 — Scaffold**, **2 — Supabase wiring & route protection**,
  **3 — Authentication**, **4 — Directory page**, **5 — Listing page**,
  **6 — Listing form**, **7 — Accounts & email**, **8 — Stripe**,
  **9 — Owner dashboard**
- Next phase: **10** (per `docs/04-CLAUDE-PROMPTS.md`)
- Phase 9 notes:
  - `/dashboard` overview (listing count vs limit, all-time views, inquiries this
    month, "action needed" cards for rejected listings / past-due payment /
    incomplete profile), `/dashboard/listings` (status badge, completeness, views,
    inquiries link, per-row Edit/View/Duplicate/Unpublish/Delete), the listing
    detail page with a **"Listing health"** card (reuses the strength maths →
    percent + one concrete suggestion), and `/dashboard/listings/[id]/inquiries`
    (marked read on open, mailto/call reply).
  - **Ownership is re-checked server-side on every listing page and action** via
    `requireOwnedListing(id)` (`lib/dashboard/guards.ts`): validates the UUID,
    `requireUser()`, then `notFound()` unless `owner_id === user.id` and not
    soft-deleted. RLS lets anyone read a *published* listing, so this explicit
    owner check is what makes the Check-it pass (a 2nd user hitting another
    owner's `/edit` URL gets a 404). Never trust the id in the URL.
  - **Owner create/edit reuse the same `ListingForm`** (Phase 6), now refactored
    to take `initial` values, a pluggable `submitFn`, `existingImages` (+ remove),
    and `redirectOnSuccess`; the anonymous flow is the default (draft autosave +
    share screen preserved). `/dashboard/listings/new` prefills the owner's
    contact details and blocks with an upgrade prompt at the plan limit;
    `/dashboard/listings/[id]/edit` is populated and shows the re-review rule
    before save.
  - **Owner actions use the RLS session, NOT the service role**
    (`lib/list-form/owner-actions.ts`) — an authenticated owner writes their own
    listings/images/tags under RLS (same as `/api/upload-url` and the Phase-9
    duplicate/soft-delete actions). Re-review rule: a **published** listing on a
    **`requires_approval`** package goes back to `pending_review` **only when a
    material field changed** (business_name, description, category, address);
    otherwise it stays live. Photo removal deletes the `listing_images` row (the
    DB queue drains the storage file) and promotes a new cover if needed.
  - Not verifiable locally without a live session + seeded data: the two-user
    ownership Check-it, real create/edit writes, and photo upload/remove (storage
    policies). Verified by `tsc --noEmit` + `npm run build` (both pass).
- Phase 8 notes:
  - `lib/stripe/client.ts` pins `apiVersion 2026-07-29.dahlia` (matches SDK v22).
    `createCheckoutSession(listingId, packageId)` + `createPortalSession()` in
    `lib/stripe/actions.ts`. Webhook at `/api/webhooks/stripe` (exempt from
    middleware via matcher): raw-body signature verify → 400 on failure (no body
    logged) → **insert stripe_events FIRST (idempotency; dup → 200)** → handle
    checkout.session.completed / subscription.updated|deleted / invoice.paid|
    payment_failed / charge.refunded → 200, or 500 to force a retry.
  - **The webhook is the ONLY writer of paid state.** The checkout=success page
    (`/dashboard/listings/[id]`) polls `is_featured` every 2s ≤30s, then a
    "we'll email you" fallback — read-only.
  - `/dashboard/billing` (plan + renewal + payment history + portal). `/dashboard`
    now lists the owner's listings → `/dashboard/listings/[id]` (upgrade path).
  - **Deviation:** packages had no `stripe_price_id`, so `ensurePackagePrice`
    lazily creates the Stripe product/price (test mode) on first checkout and
    persists it — `stripe_price_id` stays the source of truth.
  - Subscription period end reads from `sub.items.data[0].current_period_end`
    (moved off the top level in the dahlia API version).

### Phase 8 manual setup / test
1. Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
2. Buy Featured with `4242…`; re-run the event (must be ignored); test a
   declined card; cancel in the portal → listing downgrades.
- Phase 7 notes:
  - Submit flow branches: signed in → theirs; **existing email (not signed in)**
    → listing saved as `draft`, redirect to `/login?next=/list-a-program/finish
    ?draft=ID`; **new email** → `auth.admin.createUser` (no password) + profile
    (onboarding_complete=false) + listing + magic-link `complete_profile` email.
    Free → pending_review (or published if `requires_approval=false`); paid →
    Phase 8. `/list-a-program/finish` claims the draft after login.
  - **Email: `render(templateKey, context)`** reads `email_templates` (27 seeded)
    + interpolates `{{vars}}` into a code-owned HTML shell; hardcoded fallbacks;
    `email_log` records every send (status/provider/error, never the body).
    Context values are HTML-escaped (XSS-safe); Phase 16 builds the editor on the
    same contract. Wired: complete_profile, listing_submitted, inquiry_received
    (Phase 5 inquiry email refactored onto it).
  - **Deviation:** the email pipeline (template read + email_log write) uses the
    service-role client — a server-only email pipeline beyond the literal
    "three places" rule, but never exposed to the client.
  - Enumeration: existing-email path redirects to /login (per the phase's Check-it);
    the success screen text itself doesn't reveal account state.
  - Not verifiable locally: real submit (creates accounts/listings), actual mail
    delivery (needs SENDGRID_API_KEY), magic-link sign-in.
- Phase 6 notes:
  - `/list-a-program` is fully DB-driven from `form_sections`/`form_fields`
    (6 sections, 13 core fields → listing columns), category-aware labels from
    `categories.ages_label/rate_label`, tag accordions from `tag_groups`
    (show_in_form), strength from `form_fields.strength_points` + photos
    (max = fields(72) + 3·5 → 100% needs photos), packages from `packages`.
  - **Flow decision (user-approved): anonymous fill, commit at submit.** Photos
    are processed in-browser (EXIF strip → WebP full ≤2000px + 400px thumb),
    previewed/reordered locally; on Publish the submit action provisions the
    account + listing + tags (service-role — the sanctioned "account provisioning
    during listing submission"), then the browser uploads photos to Supabase via
    signed URLs and shows the success screen. Account *flow* (set-password email,
    Featured checkout) is Phase 7.
  - `/api/upload-url` = the authenticated edit-flow path (verifies ownership +
    entitlements before signing). Address: Places autocomplete + manual, geocoded
    server-side (`GOOGLE_GEOCODING_API_KEY`) when Places didn't supply coords.
    Add-on picker slot left empty (`data-addon-slot`) for Phase 13.
  - Not verifiable locally (need live infra): the real submit (creates accounts/
    listings), photo upload (storage bucket policies), Places (blocked Maps key).
- Phase 5 notes:
  - `/listing/[slug]` uses `getListingBySlug` (RLS-gated: drafts 404 for non-
    owners/staff, published for all; soft-deleted → 404). Gallery lightbox,
    sanitised description (DOMPurify), category-labelled Details, subjects chips,
    single-pin map + Get-directions, contact form, sticky sidebar, share row,
    JSON-LD LocalBusiness, OG metadata.
  - **Two new SECURITY DEFINER migrations must be applied** (RLS blocks anon
    writes): `create_inquiry` (contact form — verified RLS blocks direct anon
    insert with 42501) and `increment_listing_view` (deduped view counter).
    Until applied, the contact form can't store/send and views don't count.
  - Contact email uses SendGrid (`lib/email/*`); no-ops without SENDGRID_API_KEY.
    Owner address is never rendered; reply-to is the enquirer.
  - lucide-react dropped brand icons → local `components/listing/brand-icons.tsx`.

### Phase 5 manual setup required
1. Apply `supabase/migrations/20260802130000_create_inquiry.sql` and
   `supabase/migrations/20260802120000_increment_listing_view.sql` (SQL editor
   or `supabase db push`).
2. Set `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` (verified sender) for the
   contact form to actually deliver mail.
3. Map still blocked by the Google key's API restrictions
   (`ApiTargetBlockedMapError`) — allow "Maps JavaScript API" on the key.
- Phase 4 notes:
  - Directory lives at `/` (web). `search_listings` returns:
    `id, slug, business_name, city, state, latitude, longitude, category_name,
    category_slug, cover_path, is_featured, completeness, total_count`. ESA is
    NOT in the RPC output — looked up separately for the tile badge.
  - Filters are entirely URL-driven (shareable/crawlable); the Server Component
    reads searchParams and calls the RPC. Tag groups are data-driven from
    tag_groups/tags (global + per-selected-category).
  - Map needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (and ideally
    `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` for AdvancedMarker styling); renders a
    graceful "Map unavailable" fallback without it. `default_map_center` +
    `listings_per_page` come from site_settings.
  - **Test data**: a throwaway user `zz-preview-seed@serna.test` and 3 listings
    with slug `zz-preview-*` were seeded to verify the page. Remove with the
    cleanup SQL in the Phase 4 PR before going live.
- Deviations from `docs/04-CLAUDE-PROMPTS.md`:
  - Pinned **Tailwind v3** (not the v4 that `create-next-app` now ships) so the
    theming spec — `tailwind.config.ts` with the `rgb(var(--c-x) / <alpha-value>)`
    placeholder — works as written.
  - `toast` was requested, but shadcn deprecated its Radix toast in favour of
    `sonner`; the app uses the `sonner` Toaster (rewritten to drop the
    `next-themes` dependency, since the site is single-theme).
  - Stack is **Next.js 15.5.22 / React 19**.
  - `supabase` CLI isn't installed locally, so `types/database.ts` was generated
    from the project's PostgREST OpenAPI schema (same shape as
    `supabase gen types`). Regenerate with the CLI once linked.
  - `requireAdmin` 403s via Next's `forbidden()` (needs
    `experimental.authInterrupts`, enabled in `next.config.ts`).
  - Login rate limiting uses a **SECURITY DEFINER RPC** `public.hit_rate_limit`
    (see `supabase/migrations/20260801120000_hit_rate_limit.sql`) so it works
    for unauthenticated requests without the service-role key. **Must be applied
    for login lockout to engage** — until then `checkRateLimit` fails open.
  - Auth pages live in a top-level `app/(auth)` group (focused card layout, no
    site header); `/auth/callback` handles email confirmation + password reset.

### Phase 3 manual setup required
1. Apply `supabase/migrations/20260801120000_hit_rate_limit.sql` (SQL editor or
   `supabase db push`) — enables the 5-per-15-min login lockout.
2. In Supabase Auth settings, add redirect URLs for `/auth/callback` on
   `localhost:3000` and both production domains, and set the Site URL. Email
   confirmation and password-reset links won't work otherwise.
3. reCAPTCHA is optional; set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` +
   `RECAPTCHA_SECRET_KEY` to activate it on register.

Update this section at the end of every phase.
