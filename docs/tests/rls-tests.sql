-- RLS negative tests.
--
-- Run against the project database (psql or the Supabase SQL editor). Each block
-- assumes an unprivileged role and asserts that a forbidden operation is denied.
-- Any block that does NOT raise "PASS ..." (or that raises "FAIL ...") is a bug.
--
-- Fill in the two placeholder UUIDs first:
--   :owner_id      — a user who owns :draft_listing
--   :other_user    — a different, non-admin user
--   :draft_listing — a listing in status 'draft' owned by :owner_id
--   :published_owned — a listing owned by :other_user you'll try to publish
--
-- In psql:  \set draft_listing '00000000-0000-0000-0000-000000000000'  (etc.)

\set ON_ERROR_STOP off

-- =====================================================================
-- 1) ANONYMOUS
-- =====================================================================
begin;
set local role anon;

-- a) read a draft listing → must return 0 rows (RLS hides non-published)
do $$
declare n int;
begin
  select count(*) into n from public.listings
    where id = :'draft_listing' and status = 'draft';
  if n > 0 then raise exception 'FAIL: anon read a draft listing'; end if;
  raise notice 'PASS: anon cannot read draft listing';
end $$;

-- b) update someone else's listing → 0 rows or error
do $$
declare n int;
begin
  update public.listings set business_name = 'hacked' where id = :'draft_listing';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: anon updated a listing'; end if;
  raise notice 'PASS: anon cannot update a listing';
exception when insufficient_privilege or others then
  raise notice 'PASS: anon update denied (%).', sqlerrm;
end $$;

-- c) read the audit log → 0 rows / denied
do $$
declare n int;
begin
  select count(*) into n from public.audit_log;
  if n > 0 then raise exception 'FAIL: anon read audit_log'; end if;
  raise notice 'PASS: anon cannot read audit_log';
exception when insufficient_privilege then
  raise notice 'PASS: anon audit_log denied';
end $$;

-- d) read payments → 0 rows / denied
do $$
declare n int;
begin
  select count(*) into n from public.payments;
  if n > 0 then raise exception 'FAIL: anon read payments'; end if;
  raise notice 'PASS: anon cannot read payments';
exception when insufficient_privilege then
  raise notice 'PASS: anon payments denied';
end $$;

rollback;

-- =====================================================================
-- 2) NON-OWNER AUTHENTICATED (acting as :other_user)
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', :'other_user', 'role', 'authenticated', 'user_role', 'user')::text, true);

-- a) update another user's (draft) listing → denied / 0 rows
do $$
declare n int;
begin
  update public.listings set business_name = 'hacked' where id = :'draft_listing';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: non-owner updated another listing'; end if;
  raise notice 'PASS: non-owner cannot update another listing';
exception when insufficient_privilege then
  raise notice 'PASS: non-owner update denied';
end $$;

-- b) escalate own role to admin → denied / 0 rows
do $$
declare n int;
begin
  update public.profiles set role = 'admin' where id = :'other_user';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: user escalated own role to admin'; end if;
  raise notice 'PASS: user cannot self-promote to admin';
exception when insufficient_privilege then
  raise notice 'PASS: role escalation denied';
end $$;

-- c) publish own listing directly → status change to published must be blocked
do $$
declare n int;
begin
  update public.listings set status = 'published', published_at = now()
    where id = :'published_owned' and owner_id = :'other_user';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: owner self-published a listing'; end if;
  raise notice 'PASS: owner cannot self-publish';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: self-publish denied';
end $$;

-- d) read another user's payments → 0 rows
do $$
declare n int;
begin
  select count(*) into n from public.payments where user_id <> :'other_user';
  if n > 0 then raise exception 'FAIL: user read another user''s payments'; end if;
  raise notice 'PASS: user cannot read others'' payments';
end $$;

-- e) read the audit log → 0 rows (staff/admin only)
do $$
declare n int;
begin
  select count(*) into n from public.audit_log;
  if n > 0 then raise exception 'FAIL: non-admin read audit_log'; end if;
  raise notice 'PASS: non-admin cannot read audit_log';
exception when insufficient_privilege then
  raise notice 'PASS: audit_log denied';
end $$;

rollback;

-- =====================================================================
-- 3) RLS is enabled on every table
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  loop
    raise warning 'FAIL: RLS disabled on public.%', r.relname;
  end loop;
  raise notice 'Checked RLS-enabled flag on all public tables (warnings above = failures).';
end $$;
