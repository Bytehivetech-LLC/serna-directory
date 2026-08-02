-- SESSION 1 · BLOCKER 1 — the Stripe webhook could permanently lose an event.
--
-- The idempotency claim inserted the event id BEFORE processing; if processing
-- threw, the catch returned 500 without releasing the claim. Stripe's retry hit
-- the duplicate check, got {duplicate:true}, and stopped — so one transient
-- error meant a customer paid and their listing never activated.
--
-- This adds a lifecycle to stripe_events so the claim only becomes permanent on
-- success. See app/api/webhooks/stripe/route.ts for the matching logic.

alter table public.stripe_events
  add column if not exists status text not null default 'processing'
    check (status in ('processing','done','failed')),
  add column if not exists attempts int not null default 0,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

-- Existing rows were all processed under the old code — mark them done so the
-- new "stuck/failed" dashboard alert doesn't flag historical events.
update public.stripe_events set status = 'done' where status = 'processing';

create index if not exists stripe_events_unfinished_idx
  on public.stripe_events(status, processed_at)
  where status <> 'done';
