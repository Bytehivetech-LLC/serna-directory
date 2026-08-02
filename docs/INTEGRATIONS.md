# Integrations, secrets & scripts

How third-party keys are stored, how to rotate them, and how to recover when one
is wrong.

## Where each key lives

| Key | Stored | Notes |
| --- | --- | --- |
| `SECRETS_ENCRYPTION_KEY` | **Env only** | 32-byte base64 master key that encrypts every stored integration secret. Generate with `npm run generate:secret-key`. Never in the database. |
| SendGrid API key | DB (encrypted) → env | `SENDGRID_API_KEY` is the fallback. |
| reCAPTCHA secret | DB (encrypted) → env | `RECAPTCHA_SECRET_KEY` fallback. |
| reCAPTCHA site key | DB (public) → env | Public; `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` fallback. |
| Maps browser key | DB (public) → env | Public; `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` fallback. |
| Stripe secret key | **Env only** | Managed in Vercel. A leak here moves money — it never touches the DB or the panel. |

**Resolution order** is always DB value first, env second (`lib/secrets/resolve.ts`).
Secrets are stored AES-256-GCM encrypted (`lib/secrets/crypto.ts`), format
`base64(iv | authTag | ciphertext)`. The panel only ever shows a **hint** (last 4
chars) — there is no reveal, and no decrypted secret is ever sent to the browser.

## How writes are protected

- Every read/write goes through a server action with `requireAdmin()`.
- Writing a secret additionally requires a **fresh MFA challenge** in the last 15
  minutes (`requireRecentMFA()`); the panel prompts for a code and retries.
- The audit log records that a secret **changed**, never its value.
- Key shapes are validated (SendGrid starts `SG.`, reCAPTCHA keys are 40 chars).

## Rotating a key

1. Get the new key from the provider.
2. Admin → Settings → Integrations → **Replace key** → paste → Save (confirm MFA).
3. Use **Send test / Test verification** to confirm it works.

The old value is overwritten; there's no history of secret values by design.

## When a key is wrong (recovery)

Because DB overrides env, a bad value saved in the panel can break sending/verifying.
To recover:

1. **Set the env var** (`SENDGRID_API_KEY`, etc.) to a known-good value and redeploy.
   Env is the fallback, so this restores service even while the DB value is bad —
   *except* the DB value takes precedence, so also:
2. In the panel, **Replace key** with the correct value (or clear the row).
   If the panel itself is unreachable, deleting the `integration_settings` row in
   Supabase falls resolution back to env.
3. If `SECRETS_ENCRYPTION_KEY` was rotated/lost, every stored secret becomes
   unreadable — resolution falls back to env automatically (a warning + a
   `last_error_message` is recorded), so set the env vars, redeploy, then
   re-enter each key in the panel under the new master key.

## Scripts & CSP

- **Guided** tags (GA4, GTM, Meta, Clarity, Hotjar, LinkedIn, TikTok) generate the
  official snippet from an ID you paste — no code. Their hosts are baked into the
  CSP so they load once activated.
- **Custom** code is gated by a one-time "I understand" acknowledgement, saved
  **inactive**, and rejected — both server-side and by a **DB trigger** — if it
  touches `document.cookie`, `localStorage`/`sessionStorage`, `eval`, or the
  `Function` constructor.
- Scripts render only via `ScriptInjector` in the **public** layout. It self-guards
  on `APP_TARGET` and is asserted in `scripts/injector.test.mjs` (`npm test`) — a
  script must never run on `/admin`.
- `applies_to` limits a script to matching pages; non-essential scripts wait for
  **consent** when the banner is on.

## Consent banner

Toggle in Settings → Scripts. Accept / Reject / Preferences, with Reject as easy as
Accept, the choice remembered in the `serna-consent` cookie, and a footer
"Cookie preferences" link to reopen it. Analytics and marketing scripts don't load
until their group is accepted.
