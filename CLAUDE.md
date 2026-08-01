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

- Phases complete: **1 — Scaffold and design system**
- Next phase: **2** (per `docs/04-CLAUDE-PROMPTS.md`)
- Deviations from `docs/04-CLAUDE-PROMPTS.md`:
  - Pinned **Tailwind v3** (not the v4 that `create-next-app` now ships) so the
    theming spec — `tailwind.config.ts` with the `rgb(var(--c-x) / <alpha-value>)`
    placeholder — works as written.
  - `toast` was requested, but shadcn deprecated its Radix toast in favour of
    `sonner`; the app uses the `sonner` Toaster (rewritten to drop the
    `next-themes` dependency, since the site is single-theme).
  - Stack is **Next.js 15.5.22 / React 19**.

Update this section at the end of every phase.
