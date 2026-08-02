# Runbook

Operational procedures for Serna Directory. Assumes the Supabase, Vercel, and
Stripe CLIs are authenticated.

## Restore a deleted listing

Soft-deleted listings keep their photos for `deletion_grace_days` (default 30).

- **In the admin** (preferred): Listings → filter status **Deleted** → open the
  listing → **Restore** (returns it to *unpublished*, never straight to public).
- **In SQL** (if past grace / already purged from the list): 
  ```sql
  update public.listings set deleted_at = null, status = 'unpublished'
  where id = '<listing-id>';
  ```
- If it was **hard-purged**, restore from a database backup (below) — the row and
  its `listing_images` are gone.

## Replay a Stripe webhook

The webhook is idempotent (keyed on the Stripe event id in `stripe_events`), so
replays are always safe.

- Stripe Dashboard → Developers → Events → find the event → **Resend**. A
  duplicate is acknowledged with 200 and not re-processed.
- Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then
  `stripe trigger checkout.session.completed`.
- To force reprocessing of a specific event, delete its row from `stripe_events`
  first, then resend.

## Reset a locked-out admin

- **Lost password**: Admin (another admin) → Users → the user → **Send password
  reset**. Or Supabase Dashboard → Authentication → Users → send recovery.
- **Lost MFA / no other admin**: Supabase Dashboard → Authentication → Users →
  the user → remove their MFA factor, then they reset the password. To regrant
  admin: `update public.profiles set role = 'admin' where id = '<user-id>';`
  (the auth hook mirrors it to the JWT on next sign-in).
- **Suspended by mistake**: `update public.profiles set is_suspended = false,
  deleted_at = null where id = '<user-id>';`

## Rotate a key

| Key | How |
| --- | --- |
| SendGrid / reCAPTCHA / Maps | Admin → Settings → Integrations → **Replace key** (needs a fresh MFA check), then **Test**. |
| `SECRETS_ENCRYPTION_KEY` | `npm run generate:secret-key`, set the new value in Vercel, redeploy. **Every stored integration secret becomes unreadable** — resolution falls back to env; then re-enter each key in the panel under the new master key. |
| Stripe secret | Rotate in Stripe → update `STRIPE_SECRET_KEY` in Vercel → redeploy. Never stored in the DB. |
| `STRIPE_WEBHOOK_SECRET` | Roll the endpoint secret in Stripe → update the env var → redeploy. |
| `CRON_SECRET` | Set a new value in Vercel; Vercel Cron sends it automatically as the Bearer token. |

**Recovery from a bad panel value:** because DB overrides env, set the correct
value via the panel's Replace, or delete the `integration_settings` row to fall
back to env, then redeploy.

## Take a database backup

- **Managed**: Supabase Dashboard → Database → Backups (daily automated on paid
  plans; trigger a manual one before risky changes).
- **CLI dump**: `supabase db dump -f backup.sql` (schema + data). Restore with
  `psql "$DATABASE_URL" -f backup.sql` against a fresh project.

## Drain a stuck asset-deletion queue

The daily cron drains `asset_deletion_queue` in batches of 100; rows that fail
three times are marked `failed` and surface on the admin dashboard's Storage panel.

- **Run it now**: `curl -H "Authorization: Bearer $CRON_SECRET"
  https://<host>/api/cron/daily`.
- **Inspect failures**: 
  ```sql
  select id, bucket_id, object_path, attempts, last_error
  from public.asset_deletion_queue where status = 'failed';
  ```
- **Retry failed rows**: `update public.asset_deletion_queue set status =
  'pending', attempts = 0, last_error = null where status = 'failed';`
- If a file is already gone from Storage, mark it done: `update
  public.asset_deletion_queue set status = 'done', processed_at = now() where
  id = <id>;`

## Find orphaned files

The weekly cron (`/api/cron/weekly`) sweeps `listing-images` for objects with no
DB reference older than 24h and enqueues them. Run it manually with the same
Bearer header. On a clean install it should enqueue nothing.

## Crons

Scheduled in `vercel.json`: daily `08:00 UTC` (`/api/cron/daily`), weekly Monday
`09:00 UTC` (`/api/cron/weekly`). Both require `Authorization: Bearer $CRON_SECRET`;
Vercel sends it automatically when `CRON_SECRET` is set.
