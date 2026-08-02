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
  **9 — Owner dashboard**, **10 — Admin shell & users**,
  **11 — Admin listings & moderation**, **12 — Admin packages & Stripe**,
  **13 — Add-on products**, **14 — Admin categories & tags**,
  **15 — Form builder, settings, menu, branding**,
  **16 — Email studio & asset lifecycle**,
  **17 — Integrations, secrets & custom scripts**,
  **18 — Hardening, SEO & launch**
- Next phase: **complete** (Phase 18 was the final launch pass)
- Phase 18 notes:
  - **SEO**: `app/sitemap.ts` (home/categories/cities/published listings, admin
    host emits none), `app/robots.ts` (admin → disallow all; web → allow +
    sitemap), directory `generateMetadata` already sets a canonical, **ItemList
    JSON-LD** on the directory, LocalBusiness JSON-LD already on listings.
    `next.config.ts` image `remotePatterns` (Supabase public objects + Google
    avatars); directory tiles now use **next/image** (`fill` + `sizes`).
  - **Reliability**: `/api/cron/daily` extended (`lib/cron/daily-tasks.ts`) —
    featured-expiry, 14-day listing renewal reminders, category-count refresh,
    rate-limit prune, and **integration health checks** (maps geocode; sendgrid/
    recaptcha presence) that stamp `last_success_at`/`last_error_*` so a dead key
    shows in the panel. `vercel.json` schedules daily 08:00 / weekly Mon 09:00
    (Vercel sends `CRON_SECRET` as the Bearer automatically). Brand-voice
    `app/error.tsx` + `app/global-error.tsx`; `lib/observability/report.ts`
    scrubs emails/tokens before logging (Sentry is a one-file wire-up from there).
    `docs/RUNBOOK.md` covers restore/replay-webhook/reset-admin/rotate-keys/
    backup/drain-queue.
  - **Security**: add-on **package availability enforced server-side** in both
    the extras checkout and the submit flow (an add-on restricted to other
    packages is refused no matter what the browser sends — the Check-it).
    reCAPTCHA now has a **review band** (`>=min` pass, `[review,min)` pass +
    `review:true`, `<review` reject). External listing links get
    `rel="noopener noreferrer nofollow"`. Rate limits added to **/api/upload-url**
    (120/hr/user) and **register** (5/15min/IP), joining the existing login/
    submit/inquiry/password-reset limits. `docs/tests/rls-tests.sql` is the
    anon + non-owner negative-test script. The raw `SUPABASE_SERVICE_ROLE_KEY`
    is referenced only in `lib/supabase/admin.ts`.
  - **Perf/a11y**: map bundle is **lazy-loaded** (`LazyListingMap` via
    next/dynamic, `ssr:false`); `prefers-reduced-motion` was already a global
    reset. Consent gating + script-injector guard (Phase 17) unchanged.
  - **`npm test`** runs the script-injector invariant (never renders on admin).
- Phase 17 notes:
  - **A — secrets**: `lib/secrets/crypto.ts` AES-256-GCM (server-only, key from
    `SECRETS_ENCRYPTION_KEY` base64/32-byte, format `base64(iv|tag|ct)`, throws at
    load if the key is bad). `npm run generate:secret-key`. `lib/secrets/resolve.ts`
    reads `integration_settings` with the **service-role** client, decrypts in
    memory, **DB-value-first then env fallback**, `cache()` per request, and
    **never throws a page** (decrypt fail → env + `last_error_message` + warn).
    Narrow helpers: `getSendgridKey/getSendgridFrom/getRecaptchaSecret/
    getRecaptchaPublicConfig/getMapsPublicConfig`. Email `sendgrid.ts` and the
    reCAPTCHA verifier now call these (env is only the fallback). **The Check-it's
    "delete env, email still sends" comes from this.** `requireRecentMFA()` guard
    (decodes the session `amr`; 15-min window) gates secret writes.
  - **B — `/admin/settings → Integrations`**: SendGrid / reCAPTCHA / Maps / Stripe
    cards (`components/admin/settings/integrations-tab.tsx`). Status pill, last
    used/error, key shown as **hint only ("ends …a8Fq · updated …") with Replace —
    never a reveal**. Secret writes go through `useSecretSave` which, on
    `mfaRequired`, prompts for a TOTP code, elevates the session in the browser,
    and retries. Actions (`lib/admin/integrations-actions.ts`) requireAdmin +
    requireRecentMFA + shape validation (SG. / 40-char) + audit that a secret
    **changed, never its value**. **The client never receives a decrypted secret.**
    Stripe secret is read-only ("Managed in Vercel").
  - **C — `/admin/settings → Scripts`**: **Guided** (GA4/GTM/Meta/Clarity/Hotjar/
    LinkedIn/TikTok — paste an ID, `lib/scripts/providers.ts` validates it and
    generates the official snippet server-side) + **Custom code** (one-time "I
    understand" ack, saved **inactive**). `ScriptInjector`
    (`components/layout/script-injector.tsx`) renders active scripts into the
    **public layout only** — self-guards on `APP_TARGET`, asserted in
    `scripts/injector.test.mjs` (`npm test`). `applies_to` scopes pages; consent
    gates non-essential. **DB trigger** (migration `20260803130000`) rejects
    `document.cookie`/storage/`eval`/`Function` — **the Check-it's rejection**;
    the action checks the same patterns first. CSP `script-src` folds in
    `GUIDED_HOSTS`; custom hosts accumulate into the `script_hosts` setting.
  - **D — consent banner** (`components/consent/consent-banner.tsx`): Accept /
    Reject / Preferences with **Reject as prominent as Accept**, remembered in the
    `serna-consent` cookie, gating analytics/marketing until accepted, with a
    footer "Cookie preferences" reopen link. Toggled by the
    `consent_banner_enabled` setting (switch on the Scripts tab).
  - **E** — `docs/INTEGRATIONS.md` (where keys live, rotation, recovery).
  - **Deliberately minimal / deferred** (documented): custom-script `external_hosts`
    are collected into the `script_hosts` setting but the middleware CSP currently
    folds in only the static `GUIDED_HOSTS` union (per-request DB reads in edge
    middleware were avoided) — wiring the stored hosts into the CSP is the
    follow-up; head-slot scripts render at the top of the public body (not literal
    `<head>`); the custom-code editor is a mono `<textarea>` (no syntax
    highlighting lib); the Maps "pick centre on a map" is numeric lat/lng/zoom.

### Phase 17 manual setup required
1. Generate + set `SECRETS_ENCRYPTION_KEY` (`npm run generate:secret-key`) in the
   environment. Without it, the app runs but **secret writes error** and stored
   secrets can't be decrypted (resolution falls back to env).
2. Apply migration `20260803130000_reject_dangerous_scripts.sql` (the DB script
   guard the Check-it relies on).
- Phase 16 notes:
  - **A — email render**: `lib/email/shell.ts` rebuilt as a **600px table**
    layout (Outlook-safe, no flex/grid), colours from the live theme (`getTheme`)
    so rebranding rebrands the emails, logo from `site_settings`, a category
    **status pill**, violet-soft callout w/ left rule, `color-scheme: light` +
    `supported-color-schemes`. `render.ts`: **markdown-lite** (`**bold**`,
    `[links](https://…)`, paragraphs); a **missing variable renders the raw
    `{{key}}` and warns** (never throws); returns `{found, enabled, locked,
    generic}`. `send.ts` uses that: optional missing/disabled → skip, locked →
    always send, and honours `profiles.email_opt_out`. `renderShape` is exported
    for the editor's live preview.
  - **B — `/admin/emails`**: list grouped by category (enabled switch — disabled
    on locked, last sent/edited); editor (`components/admin/email/*`) two-pane
    with a **variable menu** (click-to-insert, sample on hover), **save-time
    validation** that refuses an unknown `{{var}}` naming it, realistic-sample
    preview (desktop/mobile iframe + plain-text), **send test**, **revision
    history** (`email_template_versions`) + one-click revert, **reset to default**
    (from the code fallback). `/admin/emails/log` filterable by template/status/
    recipient with the provider error on failures.
  - **C — wiring**: `lib/email/admin-alerts.ts` → `email_admin_recipients`
    setting. `admin_listing_pending` fires on submit; **email preferences** on
    `/dashboard/profile` (`email_opt_out`, migration `20260803120000`) let owners
    opt out of expiry nudges / welcome / tips only. Comprehensive **code
    fallbacks** added for every catalogued key so nothing silently skips before
    the DB seed exists.
  - **D — asset lifecycle** (`lib/assets/lifecycle.ts`): `/api/cron/daily`
    (addon expiry + **PURGE** listings past `deletion_grace_days` — cascade +
    trigger enqueue — + **DRAIN** the queue 100/batch via the Storage API with
    attempts/last_error/3-strike fail) and `/api/cron/weekly` (**SWEEP**
    unreferenced `listing-images` objects older than 24h; stamps `last_sweep_at`).
    Enqueue-on-replace wired for branding logo/favicon, add-on card image, and a
    deleted user's avatar. Admin listing editor gets **Delete permanently**
    (typed `DELETE PERMANENTLY`). Admin dashboard gets a **Storage panel** (image
    bytes, pending, failed, last sweep).
  - **E** — `docs/EMAILS.md` catalogues every template, trigger, variables, and
    recipient.
  - **Deliberately minimal / deferred** (documented): the sweep covers
    `listing-images` (site-assets/avatars stay tidy via enqueue-on-replace);
    several C events (welcome, admin_addon_fulfilment, admin_payment_received,
    subscription_renewed/canceled, listing_edit_pending/unpublished/blocked/
    expired) have fallbacks + docs but are only wired where the triggering event
    already existed — the rest are one `sendTemplateEmail`/`sendAdminAlert` call
    at each new event site.

### Phase 16 manual setup required
1. Apply migration `20260803120000_profiles_email_opt_out.sql`.
2. Schedule the crons (Vercel Cron, `Authorization: Bearer $CRON_SECRET`):
   daily `GET /api/cron/daily`, weekly `GET /api/cron/weekly`. (The old
   `/api/cron/addons` still works but `daily` supersedes it.)
3. Optional settings: `deletion_grace_days` (default 30), `email_admin_recipients`.
- Phase 15 notes:
  - **A — `/admin/form-builder`**: two-pane (`components/admin/form-builder/*`).
    Left = sections/fields tree with arrow reorder, section dialog, field editor
    dialog; right = live `FormPreview` with a **"Preview as category"** selector.
    Field editor: label/help/placeholder/type/options/required/max-length/strength/
    show-on-public/category-scope. **Core fields are locked** (relabel/reorder/
    required only — never type/delete; the lock tooltip explains why). Deleting a
    custom field only removes the `form_fields` row — **saved values stay in each
    listing's `custom_fields`**; `fieldUsageAction` reports the count for the
    warning. Actions revalidate `/list-a-program` — no deploy.
  - **B — `/admin/settings`** (tabbed):
    - **Branding**: site name, logo mark letter, logo + favicon upload to
      `site-assets/branding/`, hero heading/subheading, footer text. The public
      `(web)/layout.tsx` now reads these + `menu_items` and feeds `SiteHeader`/
      `SiteFooter` (logo image or mark letter, brand name, nav, footer text).
    - **Theme**: two-pane editor (`components/admin/settings/theme-editor.tsx`).
      Controls grouped (Text/Brand/Surfaces/Borders/States/Shape/Type); each
      colour row = swatch + hex + **EyeDropper** (where supported) + reset-one.
      Live preview repaints via a **scoped** `:root`→`.theme-preview` block
      (`toCssVarsScoped`) so the same Tailwind utilities recolour instantly.
      Edits debounce-save to **`theme_draft`**; **Publish** copies draft→`theme`
      (revalidate `"/","layout"`); discard/reset confirm. Presets = 3 built-ins
      (Serna default + Warmer + Higher-contrast) plus user presets in
      `theme_presets`. **Contrast guard** (`lib/theme/contrast.ts`, WCAG AA) hard-
      blocks publish and names failing pairs (faint-on-card is advisory only, so
      the brand default stays publishable). Server Zod re-validates hex/radius
      (0–24)/fonts (allowlist) — values only ever go into the `:root` block.
    - **`?theme=draft`** preview: middleware sets a `serna-theme-preview` cookie;
      the **root layout** honours it *only* for signed-in admins (`getDraftTheme`
      via RLS), everyone else keeps the published theme.
    - **Navigation**: header/footer menu builder (label, url, new-tab, reorder,
      one level of nesting, activate) → `menu_items`.
    - **Directory**: per-page, default sort, review-SLA days, pending-direct-link.
    - **Maps**: default centre lat/lng/zoom + browser key.
    - **Email**: from name/address, admin recipients, **send test email**.
    - **Integrations / Scripts**: deliberate placeholders (Phase 17).
  - All settings/theme/form actions requireAdmin + Zod + logAudit and revalidate
    the affected public paths.
  - **Deliberately minimal / deferred** (documented): custom fonts aren't actually
    web-loaded (only Bricolage/Inter self-hosted; a picked font falls back through
    the stack); the Maps tab uses numeric centre/zoom inputs rather than a
    click-to-pick embedded map; new field types (number/multiselect/date) render
    as best-effort inputs in the preview and aren't yet wired into the public
    `DynamicField`. The DB trigger validating theme writes is assumed present and
    untouched.

### Phase 15 manual setup / notes
- No new migrations. Uses existing `site_settings` keys (`theme`, `theme_draft`,
  `theme_presets`, `site_name`, `logo_url`, `logo_mark_letter`, `favicon_url`,
  `hero_heading`, `hero_subheading`, `footer_text`, `listings_per_page`,
  `default_sort`, `review_sla_days`, `allow_pending_direct_link`,
  `default_map_center`, `google_maps_browser_key`, `email_from_name`,
  `email_from_address`, `admin_notification_recipients`) and `menu_items`.
- Phase 14 notes:
  - `/admin/taxonomy` — three tabs (`components/admin/taxonomy/*`). No new
    migrations; it drives the existing `categories` / `tag_groups` / `tags`
    tables, and the public readers already key off the flags:
    `lib/directory/queries.ts` (`show_in_filter`), `lib/list-form/queries.ts`
    (`show_in_form`), `lib/listing/queries.ts` (`show_on_listing`). So every
    save in `lib/admin/taxonomy-actions.ts` calls a `revalidatePublic()` that
    revalidates `/` and `/list-a-program` — **changes go live with no deploy**
    (the Check-it: an "Age" group with show-in-filters appears on the directory).
  - **Categories tab**: table (name, slug, live listing count, active, order),
    drag + arrow reorder, create/edit dialog (name, slug with an in-use warning,
    icon, description, the form's ages/rate labels, active). Delete is blocked
    when listings exist → a **move-listings picker** reassigns them first
    (`moveCategoryListingsAction`), then delete.
  - **Tag groups tab**: table with scope (All / a category), selection type, and
    the three flags as **inline switches** (`toggleGroupFlagAction`); create/edit
    dialog adds description, sort mode (alphabetical/manual), active. Drag reorder.
    Delete blocked when the group's tags are in use.
  - **Tags tab**: group picker, inline add (Enter), **bulk paste** (one per line,
    dedupes by slug — the "Age → 1,2,3,4 in ten seconds" flow), inline rename
    (slug kept stable so filter URLs don't break), active switch, arrow reorder,
    per-tag listing count, **merge** (moves `listing_tags` onto the target,
    dropping duplicate pairs — `listing_tags` is a composite key, no id column),
    and delete (confirms with the in-use count).
  - Counts shown are **live** (computed from `listings`/`listing_tags`), not a
    denormalised column, so they're always accurate.
- Phase 13 notes:
  - **Entitlements are the one source of truth.** `listing_entitlements(listing_id)`
    was redefined (migration `20260803110000`) to fold ACTIVE `listing_addons`
    onto the package baseline — extra_images/priority_boost sum in, featured_days/
    homepage_slot/video_embed/inquiry_alerts/verified_badge flip on. SECURITY
    DEFINER, granted anon/authenticated/service_role. The image uploader
    (`/api/upload-url`), submit/owner image caps, and the listing page's verified
    badge all read it. **The Check-it's 8→18 gallery + refused 19th photo come
    straight from this** (the upload route 409s at `count >= max_images`).
  - **A — `/admin/addons`**: catalogue mirroring packages (drag/arrow reorder,
    times-sold, Stripe status banner). Create/edit form: effect select (manual /
    extra_images / extra_listings / featured_days / homepage_slot / video_embed /
    priority_boost / inquiry_alerts / verified_badge from `lib/addons/effects.ts`),
    effect_value, duration_days, max_quantity, package availability, fulfilment
    note, card image upload to `site-assets/addons/{id}`. Reuses the Phase 12
    Stripe sync (`kind: "addon"`); delete blocked on active purchases → archive.
  - **B — buying**: shared `ExtrasPicker` (cards, qty stepper, info popover)
    rendered after the package cards on the listing form with a **running total**
    ("Free listing + Newsletter spotlight + 10× extra photos = $75 today") and a
    "Continue to checkout" submit; also `/dashboard/listings/[id]/extras` (active
    w/ expiry, buy more, purchase history).
  - **C — checkout/webhook**: `createExtrasCheckoutAction` (dashboard, RLS) and
    `buildAddonCheckout` inside the public submit (service-role, sanctioned
    provisioning path — buyer may be brand-new) both write `listing_addons` as
    **pending_payment keyed to the session id** before redirect. Mixed intervals:
    one Checkout is one-time OR one same-interval subscription; **mixed selections
    are refused** with guidance (two-session sequencing is the documented future
    path). Webhook `checkout.session.completed` with `purpose:"addons"` records a
    payment, flips rows to **active**, stamps starts_at + expires_at (from
    duration_days), links the payment, and emails an itemised confirmation.
    `charge.refunded` cascades add-ons → refunded (entitlement drops).
  - **E — `/admin/fulfilment`**: manual + active add-ons, oldest first, **7-day
    ageing flag**, with the add-on's fulfilment note. Mark fulfilled (emails the
    owner), add internal note, refund (Stripe deep link).
  - **F/G**: verified badge shows on the listing page from entitlements; expiry
    **cron** at `/api/cron/addons` (Bearer `CRON_SECRET`) expires past-due add-ons
    and emails a 7-day renewal warning once (`renewal_reminded_at`). New email
    fallbacks: `addons_purchased`, `addon_expiring`, `addon_fulfilled`.
  - **Deliberately deferred** (documented, not wired): video-embed rendering (no
    listing video column yet), the homepage spotlight rail, and feeding
    priority_boost into `search_listings` ordering (needs the RPC to add the
    entitlement or persist effective priority). Recurring add-on renewal via
    `invoice.paid` is also not yet extended.

### Phase 13 manual setup required
1. Apply migrations `20260803110000_entitlements_addons.sql` (the entitlements
   redefinition — **required for the Check-it**) and
   `20260803110500_listing_addons_reminder.sql`.
2. Set `CRON_SECRET` and schedule a daily `GET /api/cron/addons`
   (`Authorization: Bearer $CRON_SECRET`) — e.g. a Vercel Cron.
- Phase 12 notes:
  - **Reusable Stripe sync** (`lib/stripe/sync.ts`, `kind: "package" | "addon"` so
    Phase 13 reuses it): `syncStripeProductPrice` creates/updates the Product and
    treats Prices as **immutable** — a price/currency/interval change mints a NEW
    price, archives the old, and returns a warning; **no one is migrated**. Free
    tier archives any existing price. `reconcileStripe` reports name/price drift
    and pushes the name to Stripe (never changes a price). `archiveStripeProduct`
    retires product+price. See `docs/STRIPE.md`.
  - `/admin/packages`: list (name, price, interval, listing limit, approval,
    active, order, **live subscriber count**) with **drag + arrow reorder**
    (auto-saves via `reorderPackagesAction`) and a **connection-status banner**
    (`lib/stripe/status.ts`: live/test from key prefix, account name, webhook
    health from latest `stripe_events`). Create/edit form covers every field +
    repeatable **feature bullets** + badge label/colour; **Sync from Stripe**
    button runs reconcile. Single-default enforced. Delete blocked when active
    subscribers (or listings) reference it → **archive instead**.
  - Package actions (`lib/admin/packages-actions.ts`, requireAdmin + Zod +
    logAudit): create/update (both run the Stripe sync, persist product/price ids,
    surface the price-change warning), reorder, archive, delete, reconcile.
  - `/admin/payments`: read-only payments table (user, listing, amount, status,
    date) + **Stripe deep links** that respect test/live mode
    (`lib/stripe/dashboard-links.ts`), status/date filters, **CSV export**
    (`/admin/payments/export` route, admin-gated), a **revenue summary** (this
    month, last month, **MRR** = active subs normalised to monthly, active subs,
    churn this month), and an active-subscriptions table. Refunds link out to
    Stripe — never performed here.
  - `ensurePackagePrice` (Phase 8) stays as the checkout-time fallback; the admin
    sync is the deliberate path.

### Phase 12 manual setup / notes
- No new migrations. Needs `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET` for
  webhooks) to create real products/prices; without it the pages still render and
  the status banner says "not configured".
- Phase 11 notes:
  - `/admin/listings`: server-side table via **`admin_list_listings`** RPC
    (EXECUTE → service_role only) — cover thumb, name, owner email, category,
    package, status, submitted, completeness; filters (status/category/package/
    ESA/featured/city/date range) + search (name+owner email+city); sortable;
    bulk **approve / unpublish / delete** (typed `DELETE`). Status filter value
    `deleted` lists soft-deleted rows for restore.
  - `/admin/listings/review`: the moderation queue — one `pending_review` at a
    time (oldest first), rendered by the **shared `ListingView`** (extracted from
    the public page so it looks exactly like production; `preview` swaps the live
    contact/claim/report for static). Sticky bar: **Approve · Request changes ·
    Reject · Skip** with keyboard **A / R / S**, a running count, and it advances
    to the next item. Reject & request-changes require a reason (emailed). Skip is
    URL-driven (`?skip=id,id`), so skipped items return next visit.
  - `/admin/listings/[id]`: full editor — content fields, **status, package,
    featured + featured_until, priority_rank, owner reassignment**, and image
    manage (remove / set cover / add via admin-signed upload URLs). A **History**
    panel shows the listing's audit trail.
  - **Moderation actions** (`lib/admin/listing-actions.ts`, all requireAdmin +
    Zod + `logAudit` + `revalidatePath("/")`): approve → published + published_at
    + reviewed_at/by + `listing_approved` email; reject → rejected + reason +
    `listing_rejected` email; request changes → **draft** + reason +
    `listing_changes_requested` email (edit link); unpublish (internal note in
    audit); feature/unfeature (end-of-day expiry); soft delete / restore (restores
    to *unpublished*, never straight public); reassign owner (by email, must have
    an account). Email link targets use `NEXT_PUBLIC_SITE_URL` (the public site),
    not the admin origin.
  - New moderation email **fallbacks** added (`listing_approved`,
    `listing_rejected`, `listing_changes_requested`) so these send even before the
    DB templates exist; if you add matching `email_templates` rows under those
    keys, the DB versions win (Phase 16 editor).
  - `mapListingDetail(client, row)` was extracted from `getListingBySlug` so the
    admin service-role loader and the public RLS loader produce the identical
    `ListingDetail`.

### Phase 11 manual setup required
1. Apply `20260803100000_admin_list_listings.sql` (the listings RPC; EXECUTE →
   service_role). Until applied, `/admin/listings` is empty.
- Phase 10 notes:
  - Admin app under `app/(admin)/admin`. The `(admin)/layout.tsx` is now async
    and calls **`requireAdmin()`** (403s non-admins, 403s suspended) — but a
    layout check is not enough, so **every admin server action calls
    `requireAdmin()` again**. `middleware.ts` already hard-404s `/admin*` on the
    web deployment (the Check-it: admin unreachable on the public site).
  - Shell: dark **indigo-deep** sidebar (`components/admin/admin-sidebar.tsx`,
    Dashboard/Listings/Users/Packages/Categories & Tags/Form builder/Payments/
    Settings/Audit log — several are forward links to later phases), top bar with
    the admin email + sign out, and a violet **ADMIN** badge. `/admin` dashboard:
    pending-review count (links to `/admin/listings?status=pending_review`),
    listings-by-status, new users this week, revenue this month, recent audit,
    a billing-attention strip (failed payments + past-due subs), and a **Stripe
    webhook-failure** alert. The webhook (`/api/webhooks/stripe`) now writes an
    `audit_log` row (`action: "stripe.webhook_failed"`, actor `stripe-webhook`)
    on both 500 paths — the handler-failure catch and the "couldn't record event"
    branch — and the dashboard counts those from the last 7 days.
  - **`logAudit()`** (`lib/audit/log.ts`) writes one immutable `audit_log` row —
    actor id+email (from the session/profile), action (`verb.noun`), entity,
    a computed before/after **diff**, IP, and user agent — via the service-role
    client, and never throws into the caller. **Use it from every mutation from
    here on.**
  - `/admin/users`: server-side search/filter (role, verified, suspended, has
    listings)/sort/pagination via the **`admin_list_users`** RPC (EXECUTE granted
    to `service_role` only; excludes soft-deleted). Bulk verify + bulk suspend.
    `/admin/users/[id]`: editable profile, their listings/subscriptions/payments/
    audit trail, and actions — verify, suspend (with reason), change role, send
    password reset, email the user, soft-delete (typed `DELETE`, **blocked when
    the user has active paid listings**). **An admin can't suspend, delete, or
    demote themselves** (enforced in the actions, disabled in the UI).
  - Admin reads/writes use the **service-role** client — the sanctioned "admin
    actions that have already verified the caller is an admin" case. Role changes
    also mirror `user_role` onto the auth user's `app_metadata` so the JWT claim
    updates promptly. Soft-deleting a user is a new `profiles.deleted_at` stamp
    (+ suspend); no profile row is ever hard-deleted.
  - Not verifiable locally (needs an admin session + applied migrations): the
    users RPC, every mutation, and the audit writes. Verified by `tsc --noEmit`
    + `npm run build` (both pass).

### Phase 10 manual setup required
1. Apply the two migrations (SQL editor or `supabase db push`):
   `20260803085000_profiles_soft_delete.sql` (adds `profiles.deleted_at`) then
   `20260803090000_admin_list_users.sql` (the users RPC). Until applied, the
   Users table is empty.
2. Deploy/run with `APP_TARGET=admin` (admin deployment) and sign in as an admin
   to reach `/admin`.
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
