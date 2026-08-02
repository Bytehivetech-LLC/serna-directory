-- Tracks when we emailed the owner the 7-day expiry reminder, so the daily cron
-- doesn't send it again on every run.
alter table public.listing_addons
  add column if not exists renewal_reminded_at timestamptz;
