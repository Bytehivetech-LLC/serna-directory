# Serna Directory

Paid listing directory for Arizona homeschool and education businesses.

- **Public site + owner dashboard** → `directory.sernaeducationalservices.com` (`APP_TARGET=web`)
- **Admin console** → `admin.sernaeducationalservices.com` (`APP_TARGET=admin`)

One repo, two Vercel deployments. `middleware.ts` 404s the other surface based
on `APP_TARGET`.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS v3 · shadcn/ui ·
Supabase · Stripe · SendGrid · Google Maps · reCAPTCHA v3 · Vercel · Cloudflare.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values (gitignored)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npx tsc --noEmit`.

## Theming

Colours are **runtime CSS variables driven by the database**, never hardcoded
hex. The `theme` row in `site_settings` is read per-request, merged over
`lib/theme/defaults.ts`, converted to space-separated RGB channels
(`lib/theme/to-css-vars.ts`), and injected as a `<style>` in the root layout.
Tailwind maps every named colour through `rgb(var(--c-x) / <alpha-value>)`, so
opacity modifiers (`bg-violet/10`) keep working. A bad theme value falls back to
the default for that slot — the site never renders unstyled.

Browse every token and component at **`/styleguide`** (dev only).

## Layout

```
app/(web)      public site + owner dashboard
app/(admin)    staff console
components/ui         shadcn primitives
components/layout     SiteHeader, SiteFooter, PageContainer, SectionCard, …
lib/theme            defaults, get-theme, to-css-vars
lib/utils            cn, slug, format
```
