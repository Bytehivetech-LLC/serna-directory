-- Soft-delete marker for user accounts. Admin "delete user" is a soft delete:
-- it stamps deleted_at (and suspends the account) so the row, its listings, and
-- its payment history are retained for audit, but the account can no longer be
-- used. No hard delete of profiles happens anywhere.
alter table public.profiles
  add column if not exists deleted_at timestamptz;
