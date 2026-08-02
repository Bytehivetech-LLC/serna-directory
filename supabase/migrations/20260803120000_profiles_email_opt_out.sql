-- Owner email preferences: a list of non-essential template keys (or the sentinel
-- "all_optional") the owner has opted out of. Essential mail — receipts,
-- enquiries, account-security — ignores this and always sends.
alter table public.profiles
  add column if not exists email_opt_out jsonb not null default '[]'::jsonb;
