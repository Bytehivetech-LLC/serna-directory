-- SESSION 1 · BLOCKER 2 — the profile guard trigger blocked its own bootstrap.
--
-- public.guard_profile_privileges reverted role/is_verified/is_suspended whenever
-- public.is_admin() was false. That includes the SQL editor (postgres) and the
-- service-role client — both carry NO end-user JWT — so promoting the first admin
-- silently did nothing, and every future admin "create user" / "change role"
-- would fail the same way with no error.
--
-- Fix: trust contexts that carry no end-user JWT (auth.uid() is null). Those are
-- the SQL editor and our own server code using the service role, both already
-- gated by requireAdmin() + RLS. Only a real browser session is locked out of
-- these columns, which is the whole point of the guard.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  new.role               := old.role;
  new.is_verified        := old.is_verified;
  new.is_suspended       := old.is_suspended;
  new.stripe_customer_id := old.stripe_customer_id;
  new.notes              := old.notes;
  return new;
end; $$;

-- Verify the lock still holds for a real user session: see the updated block 2b
-- in docs/tests/rls-tests.sql — a normal user's `update profiles set role='admin'`
-- must leave role unchanged (the row updates, the trigger reverts the column).
