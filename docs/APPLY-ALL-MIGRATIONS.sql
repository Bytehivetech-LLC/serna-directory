-- ALL MIGRATIONS, in order. Paste into the Supabase SQL editor and Run.
-- Safe to re-run: every statement uses create-or-replace / if-not-exists /
-- on-conflict-do-nothing. Generated 18 files.


-- ============================================================
-- 20260801120000_hit_rate_limit.sql
-- ============================================================
-- Atomic fixed-window rate limiter callable by anon/authenticated.
--
-- RLS blocks direct writes to rate_limits (correctly), but login rate limiting
-- must run for UNAUTHENTICATED requests. This SECURITY DEFINER function runs as
-- the owner, bypassing RLS for just this one controlled operation, so the app
-- never needs the service-role key to rate limit. It also increments
-- atomically, avoiding the read-modify-write races of a client-side counter.
--
-- Returns whether the current request is allowed, how many remain in the
-- window, and when the window resets.

create or replace function public.hit_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_window_seconds is null or p_window_seconds < 1 then
    p_window_seconds := 1;
  end if;

  -- Floor "now" to the start of the current fixed window.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (bucket, window_start, hits)
    values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  return query
    select
      v_hits <= p_limit,
      greatest(0, p_limit - v_hits),
      v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public;
grant execute on function public.hit_rate_limit(text, integer, integer)
  to anon, authenticated;

-- ============================================================
-- 20260802120000_increment_listing_view.sql
-- ============================================================
-- Fire-and-forget view counter for the public listing page.
--
-- RLS blocks anon UPDATEs on listings (owners/staff only), but a public view
-- ping must run for anonymous visitors. This SECURITY DEFINER function bumps
-- the counter for that one controlled operation — no service-role key needed —
-- and only for published listings (drafts don't accrue public views).

create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
     set view_count = coalesce(view_count, 0) + 1
   where id = p_listing_id
     and status = 'published'
     and deleted_at is null;
$$;

revoke all on function public.increment_listing_view(uuid) from public;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

-- ============================================================
-- 20260802130000_create_inquiry.sql
-- ============================================================
-- Public contact-form submissions.
--
-- RLS blocks anon INSERTs on inquiries (correctly — the table isn't world-
-- writable). But the public contact form must accept messages from anonymous
-- visitors. This SECURITY DEFINER function performs that one controlled insert
-- (only for published, non-deleted listings), so the app never needs the
-- service-role key for it. Returns the new inquiry id.

create or replace function public.create_inquiry(
  p_listing_id uuid,
  p_name text,
  p_email text,
  p_message text,
  p_phone text default null,
  p_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ip inet;
begin
  if not exists (
    select 1 from public.listings
     where id = p_listing_id
       and status = 'published'
       and deleted_at is null
  ) then
    raise exception 'Listing not available for inquiries';
  end if;

  begin
    v_ip := nullif(p_ip, '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.inquiries
    (listing_id, name, email, phone, message, status, ip_address, user_agent)
  values
    (p_listing_id, p_name, p_email, nullif(p_phone, ''), p_message, 'new',
     v_ip, p_user_agent)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_inquiry(uuid, text, text, text, text, text, text)
  from public;
grant execute on function public.create_inquiry(uuid, text, text, text, text, text, text)
  to anon, authenticated;

-- ============================================================
-- 20260803085000_profiles_soft_delete.sql
-- ============================================================
-- Soft-delete marker for user accounts. Admin "delete user" is a soft delete:
-- it stamps deleted_at (and suspends the account) so the row, its listings, and
-- its payment history are retained for audit, but the account can no longer be
-- used. No hard delete of profiles happens anywhere.
alter table public.profiles
  add column if not exists deleted_at timestamptz;

-- ============================================================
-- 20260803090000_admin_list_users.sql
-- ============================================================
-- Admin user directory: server-side search, filter, sort, pagination + a
-- per-user listing count and a window total, all in one round trip. This keeps
-- the admin Users table from ever fetching every row and filtering in the
-- browser.
--
-- Security: EXECUTE is revoked from anon/authenticated and granted ONLY to
-- service_role. The admin server actions already verify the caller is an admin
-- (requireAdmin) and then call this via the service-role client, so no listing
-- of every user is ever reachable from an untrusted session.

create or replace function public.admin_list_users(
  p_q text default null,
  p_role text default null,
  p_verified boolean default null,
  p_suspended boolean default null,
  p_has_listings boolean default null,
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  is_verified boolean,
  is_suspended boolean,
  listing_count bigint,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      p.email,
      p.full_name,
      p.role,
      p.is_verified,
      p.is_suspended,
      coalesce(l.cnt, 0) as listing_count,
      p.created_at
    from public.profiles p
    left join lateral (
      select count(*)::bigint as cnt
      from public.listings x
      where x.owner_id = p.id and x.deleted_at is null
    ) l on true
    where
      p.deleted_at is null
      and (p_q is null
        or p.email ilike '%' || p_q || '%'
        or coalesce(p.full_name, '') ilike '%' || p_q || '%')
      and (p_role is null or p.role::text = p_role)
      and (p_verified is null or p.is_verified = p_verified)
      and (p_suspended is null or p.is_suspended = p_suspended)
  ),
  filtered as (
    select * from base
    where
      p_has_listings is null
      or (p_has_listings = true and listing_count > 0)
      or (p_has_listings = false and listing_count = 0)
  ),
  counted as (
    select *, count(*) over() as total_count from filtered
  )
  select
    id, email, full_name, role, is_verified, is_suspended,
    listing_count, created_at, total_count
  from counted
  order by
    case when p_sort = 'name'    and p_dir = 'asc'  then full_name    end asc  nulls last,
    case when p_sort = 'name'    and p_dir = 'desc' then full_name    end desc nulls last,
    case when p_sort = 'email'   and p_dir = 'asc'  then email        end asc,
    case when p_sort = 'email'   and p_dir = 'desc' then email        end desc,
    case when p_sort = 'role'    and p_dir = 'asc'  then role::text   end asc,
    case when p_sort = 'role'    and p_dir = 'desc' then role::text   end desc,
    case when p_sort = 'listings' and p_dir = 'asc'  then listing_count end asc,
    case when p_sort = 'listings' and p_dir = 'desc' then listing_count end desc,
    case when p_sort = 'created_at' and p_dir = 'asc'  then created_at end asc,
    case when p_sort = 'created_at' and p_dir = 'desc' then created_at end desc,
    created_at desc
  limit greatest(coalesce(p_limit, 25), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.admin_list_users(
  text, text, boolean, boolean, boolean, text, text, int, int
) from public;

grant execute on function public.admin_list_users(
  text, text, boolean, boolean, boolean, text, text, int, int
) to service_role;

-- ============================================================
-- 20260803100000_admin_list_listings.sql
-- ============================================================
-- Admin listings directory: server-side search / filter / sort / pagination
-- joining owner email, category, package, and a cover thumbnail — one round
-- trip, with a window total. EXECUTE is granted only to service_role; the admin
-- server actions verify the caller is an admin, then call this via the
-- service-role client.
--
-- Status filter accepts the special value 'deleted' to list soft-deleted rows
-- (so an admin can restore them); any other status lists only non-deleted rows.

create or replace function public.admin_list_listings(
  p_q text default null,
  p_status text default null,
  p_category_id uuid default null,
  p_package_id uuid default null,
  p_esa text default null,
  p_featured boolean default null,
  p_city text default null,
  p_from date default null,
  p_to date default null,
  p_sort text default 'submitted',
  p_dir text default 'desc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  business_name text,
  owner_email text,
  category_name text,
  package_name text,
  status public.listing_status,
  is_featured boolean,
  completeness int,
  city text,
  submitted_at timestamptz,
  created_at timestamptz,
  cover_path text,
  total_count bigint
)
language sql
stable
as $$
  with base as (
    select
      l.id,
      l.slug,
      l.business_name,
      p.email as owner_email,
      c.name as category_name,
      pk.name as package_name,
      l.status,
      l.is_featured,
      l.completeness,
      l.city,
      l.submitted_at,
      l.created_at,
      cov.path as cover_path,
      coalesce(l.submitted_at, l.created_at) as sort_submitted
    from public.listings l
    left join public.profiles p on p.id = l.owner_id
    left join public.categories c on c.id = l.category_id
    left join public.packages pk on pk.id = l.package_id
    left join lateral (
      select coalesce(i.thumb_path, i.storage_path) as path
      from public.listing_images i
      where i.listing_id = l.id
      order by i.is_cover desc, i.sort_order asc
      limit 1
    ) cov on true
    where
      (case
        when p_status = 'deleted' then l.deleted_at is not null
        else l.deleted_at is null and (p_status is null or l.status::text = p_status)
      end)
      and (p_category_id is null or l.category_id = p_category_id)
      and (p_package_id is null or l.package_id = p_package_id)
      and (p_esa is null or l.accepts_esa::text = p_esa)
      and (p_featured is null or l.is_featured = p_featured)
      and (p_city is null or l.city ilike '%' || p_city || '%')
      and (p_from is null or coalesce(l.submitted_at, l.created_at) >= p_from)
      and (p_to is null or coalesce(l.submitted_at, l.created_at) < (p_to + 1))
      and (
        p_q is null
        or l.business_name ilike '%' || p_q || '%'
        or coalesce(p.email, '') ilike '%' || p_q || '%'
        or coalesce(l.city, '') ilike '%' || p_q || '%'
      )
  ),
  counted as (
    select *, count(*) over() as total_count from base
  )
  select
    id, slug, business_name, owner_email, category_name, package_name,
    status, is_featured, completeness, city, submitted_at, created_at,
    cover_path, total_count
  from counted
  order by
    case when p_sort = 'name'       and p_dir = 'asc'  then business_name end asc,
    case when p_sort = 'name'       and p_dir = 'desc' then business_name end desc,
    case when p_sort = 'status'     and p_dir = 'asc'  then status::text  end asc,
    case when p_sort = 'status'     and p_dir = 'desc' then status::text  end desc,
    case when p_sort = 'completeness' and p_dir = 'asc'  then completeness end asc,
    case when p_sort = 'completeness' and p_dir = 'desc' then completeness end desc,
    case when p_sort = 'submitted'  and p_dir = 'asc'  then sort_submitted end asc,
    case when p_sort = 'submitted'  and p_dir = 'desc' then sort_submitted end desc,
    sort_submitted desc
  limit greatest(coalesce(p_limit, 25), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.admin_list_listings(
  text, text, uuid, uuid, text, boolean, text, date, date, text, text, int, int
) from public;

grant execute on function public.admin_list_listings(
  text, text, uuid, uuid, text, boolean, text, date, date, text, text, int, int
) to service_role;

-- ============================================================
-- 20260803110000_entitlements_addons.sql
-- ============================================================
-- listing_entitlements is the ONE source of truth for every limit and perk.
-- This redefinition folds ACTIVE add-on purchases (listing_addons) on top of the
-- package baseline, so the image uploader, listing-count check, search ordering,
-- video field, homepage rail, and the verified badge all read the same numbers.
--
-- A perk is only granted by an add-on row that is status='active' and not past
-- its expires_at — which is set by the Stripe webhook, never by the browser.
--
-- SECURITY DEFINER so the public listing page (anon) can read a published
-- listing's perks (video/badge) without exposing the underlying rows.

create or replace function public.listing_entitlements(p_listing_id uuid)
returns table (
  featured boolean,
  max_images integer,
  video_embed boolean,
  max_listings integer,
  homepage_slot boolean,
  priority_rank integer,
  inquiry_alerts boolean,
  verified_badge boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_owner uuid;
  v_is_verified boolean := false;
  base_max_images int := 8;
  base_max_listings int := 1;
  base_priority int := 0;
  a_extra_images int := 0;
  a_priority int := 0;
  a_featured boolean := false;
  a_homepage boolean := false;
  a_video boolean := false;
  a_inquiry boolean := false;
  a_verified boolean := false;
  o_extra_listings int := 0;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    return query select false::boolean, 8::int, false::boolean, 1::int,
                        false::boolean, 0::int, false::boolean, false::boolean;
    return;
  end if;
  v_owner := v_listing.owner_id;
  base_priority := coalesce(v_listing.priority_rank, 0);

  -- Package baseline.
  if v_listing.package_id is not null then
    select coalesce(p.max_images, 8), coalesce(p.max_listings, 1)
      into base_max_images, base_max_listings
      from public.packages p where p.id = v_listing.package_id;
  end if;

  select coalesce(bool_or(is_verified), false) into v_is_verified
    from public.profiles where id = v_owner;

  -- Active add-ons ON THIS LISTING.
  select
    coalesce(sum(case when ad.effect = 'extra_images'   then ad.effect_value * la.quantity else 0 end), 0),
    coalesce(sum(case when ad.effect = 'priority_boost' then ad.effect_value * la.quantity else 0 end), 0),
    coalesce(bool_or(ad.effect = 'featured_days'), false),
    coalesce(bool_or(ad.effect = 'homepage_slot'), false),
    coalesce(bool_or(ad.effect = 'video_embed'), false),
    coalesce(bool_or(ad.effect = 'inquiry_alerts'), false),
    coalesce(bool_or(ad.effect = 'verified_badge'), false)
  into a_extra_images, a_priority, a_featured, a_homepage, a_video, a_inquiry, a_verified
  from public.listing_addons la
  join public.addons ad on ad.id = la.addon_id
  where la.listing_id = p_listing_id
    and la.status = 'active'
    and (la.expires_at is null or la.expires_at > now());

  -- Extra-listings add-ons are account-level: sum across everything the owner holds.
  select coalesce(sum(ad.effect_value * la.quantity), 0)
    into o_extra_listings
  from public.listing_addons la
  join public.addons ad on ad.id = la.addon_id
  where la.owner_id = v_owner
    and ad.effect = 'extra_listings'
    and la.status = 'active'
    and (la.expires_at is null or la.expires_at > now());

  return query select
    (coalesce(v_listing.is_featured, false) or a_featured),
    (base_max_images + a_extra_images),
    a_video,
    (base_max_listings + o_extra_listings),
    a_homepage,
    (base_priority + a_priority),
    a_inquiry,
    (v_is_verified or a_verified);
end;
$$;

grant execute on function public.listing_entitlements(uuid)
  to anon, authenticated, service_role;

-- ============================================================
-- 20260803110500_listing_addons_reminder.sql
-- ============================================================
-- Tracks when we emailed the owner the 7-day expiry reminder, so the daily cron
-- doesn't send it again on every run.
alter table public.listing_addons
  add column if not exists renewal_reminded_at timestamptz;

-- ============================================================
-- 20260803120000_profiles_email_opt_out.sql
-- ============================================================
-- Owner email preferences: a list of non-essential template keys (or the sentinel
-- "all_optional") the owner has opted out of. Essential mail — receipts,
-- enquiries, account-security — ignores this and always sends.
alter table public.profiles
  add column if not exists email_opt_out jsonb not null default '[]'::jsonb;

-- ============================================================
-- 20260803130000_reject_dangerous_scripts.sql
-- ============================================================
-- Defence in depth for custom scripts: the DB rejects code that reaches for
-- cookies or evaluates dynamic strings, even if the server-side validation were
-- ever bypassed. The admin actions validate the same patterns; this is the
-- backstop the Check-it verifies. Do not remove it.

create or replace function public.reject_dangerous_script()
returns trigger
language plpgsql
as $$
begin
  if new.code is not null and (
    new.code ~* 'document\s*\.\s*cookie'
    or new.code ~* '\beval\s*\('
    or new.code ~* 'new\s+Function\s*\('
    or new.code ~* '\.\s*(localStorage|sessionStorage)\b'
  ) then
    raise exception 'Script rejected: it accesses cookies/storage or evaluates dynamic code, which is not allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_dangerous_script on public.site_scripts;
create trigger trg_reject_dangerous_script
  before insert or update on public.site_scripts
  for each row execute function public.reject_dangerous_script();

-- ============================================================
-- 20260803140000_theme_warn_track.sql
-- ============================================================
-- 4.2 — fold the previously-hardcoded warn/track colours into the theme system.
--
-- Adds warnInk / warnStrong / warnIcon (text/icon on the "warm" surface) and
-- track (progress-bar track) to any existing `theme` / `theme_draft` rows.
--
-- The app does NOT depend on this migration to function — lib/theme/get-theme.ts
-- mergeTheme() already falls back to lib/theme/defaults.ts for any missing key,
-- and every future publish from the editor writes the full object. This backfill
-- just seeds the four new keys into rows saved before this change.
--
-- MERGE semantics: `defaults || value` puts the new defaults UNDER the existing
-- value, so any colour the admin already customised wins and nothing is
-- overwritten. Keys that don't exist yet (the four new ones) take the default.

update public.site_settings
set value =
  jsonb_build_object(
    'warnInk',   '#7a5a1e',
    'warnStrong','#5c430f',
    'warnIcon',  '#b4791e',
    'track',     '#edecf7'
  ) || value
where key in ('theme', 'theme_draft')
  and jsonb_typeof(value) = 'object';

-- NOTE: if validate_theme_setting enforces a key ALLOWLIST (rather than only
-- validating hex format), extend it to accept warnInk/warnStrong/warnIcon/track
-- before applying this — otherwise the trigger will reject the update. See 4.3,
-- which extends the same validator for the admin_theme key.

-- ============================================================
-- 20260803150000_admin_theme.sql
-- ============================================================
-- 4.3 — give the admin panel its own theme (admin_theme), separate from the
-- public `theme`. Seeded with the current dark indigo-deep sidebar so nothing
-- changes visually on upgrade.
--
-- The app does NOT require this row to function — lib/theme/get-theme.ts
-- getAdminTheme() falls back to lib/theme/admin-defaults.ts. This seeds an
-- explicit, editable row.

insert into public.site_settings (key, value, is_public)
values (
  'admin_theme',
  jsonb_build_object(
    -- text
    'ink', '#201f3a', 'muted', '#6e6c8a', 'faint', '#a4a2bf',
    -- brand
    'indigo', '#2e2e8f', 'indigoDeep', '#232268', 'violet', '#6c4ce8', 'violetSoft', '#efeafd',
    -- surfaces
    'bg', '#f7f6fd', 'card', '#ffffff', 'border', '#e7e5f4', 'borderStrong', '#d5d2ec',
    -- status
    'good', '#1a8f5c', 'goodSoft', '#dcf3e8', 'warm', '#fff8f0', 'warmBorder', '#f4dfc0',
    'warnInk', '#7a5a1e', 'warnStrong', '#5c430f', 'warnIcon', '#b4791e',
    'danger', '#d64545', 'dangerSoft', '#fbe7e7', 'track', '#edecf7',
    -- header
    'headerBg', '#232268', 'headerText', '#ffffff',
    -- admin-only: sidebar + brand bar (current dark indigo-deep shell)
    'sidebarBg', '#232268', 'sidebarText', '#ffffff',
    'sidebarActiveBg', '#6c4ce8', 'sidebarActiveText', '#ffffff', 'sidebarBorder', '#34327e',
    'brandBarBg', '#232268', 'brandBarText', '#ffffff',
    -- shape + type
    'radius', '16px', 'fontDisplay', 'Bricolage Grotesque', 'fontBody', 'Inter'
  ),
  false  -- admin_theme is staff-only, not world-readable
)
on conflict (key) do nothing;

-- admin_logo_url: optional separate logo for the admin brand bar. No seed value
-- (falls back to the public logo, then the letter mark). Insert an empty row so
-- the setting key exists for the admin UI to update.
insert into public.site_settings (key, value, is_public)
values ('admin_logo_url', to_jsonb(''::text), false)
on conflict (key) do nothing;

-- NOTE (validate_theme_setting): if that trigger validates theme-shaped rows by
-- a KEY ALLOWLIST, extend it to accept the `admin_theme` key with the SAME
-- hex-only rules it applies to `theme` (plus the seven sidebar*/brandBar* keys).
-- If it only validates hex FORMAT of whatever keys are present, this seed and
-- future admin_theme writes already satisfy it and no change is needed. The
-- current trigger body isn't in this repo's migrations, so this is left as a
-- documented step rather than a blind ALTER.

-- ============================================================
-- 20260803160000_guard_profile_privileges.sql
-- ============================================================
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

-- ============================================================
-- 20260803170000_stripe_events_status.sql
-- ============================================================
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

-- ============================================================
-- 20260803180000_admin_list_users_avatar.sql
-- ============================================================
-- 5.1 — surface avatars in the admin Users list. Adds avatar_url to
-- admin_list_users. Changing the OUT columns means dropping + recreating (a
-- plain CREATE OR REPLACE can't change a function's result type).

drop function if exists public.admin_list_users(
  text, text, boolean, boolean, boolean, text, text, int, int
);

create function public.admin_list_users(
  p_q text default null,
  p_role text default null,
  p_verified boolean default null,
  p_suspended boolean default null,
  p_has_listings boolean default null,
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.user_role,
  is_verified boolean,
  is_suspended boolean,
  listing_count bigint,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      p.email,
      p.full_name,
      p.avatar_url,
      p.role,
      p.is_verified,
      p.is_suspended,
      coalesce(l.cnt, 0) as listing_count,
      p.created_at
    from public.profiles p
    left join lateral (
      select count(*)::bigint as cnt
      from public.listings x
      where x.owner_id = p.id and x.deleted_at is null
    ) l on true
    where
      p.deleted_at is null
      and (p_q is null
        or p.email ilike '%' || p_q || '%'
        or coalesce(p.full_name, '') ilike '%' || p_q || '%')
      and (p_role is null or p.role::text = p_role)
      and (p_verified is null or p.is_verified = p_verified)
      and (p_suspended is null or p.is_suspended = p_suspended)
  ),
  filtered as (
    select * from base
    where
      p_has_listings is null
      or (p_has_listings = true and listing_count > 0)
      or (p_has_listings = false and listing_count = 0)
  ),
  counted as (
    select *, count(*) over() as total_count from filtered
  )
  select
    id, email, full_name, avatar_url, role, is_verified, is_suspended,
    listing_count, created_at, total_count
  from counted
  order by
    case when p_sort = 'name'    and p_dir = 'asc'  then full_name    end asc  nulls last,
    case when p_sort = 'name'    and p_dir = 'desc' then full_name    end desc nulls last,
    case when p_sort = 'email'   and p_dir = 'asc'  then email        end asc,
    case when p_sort = 'email'   and p_dir = 'desc' then email        end desc,
    case when p_sort = 'role'    and p_dir = 'asc'  then role::text   end asc,
    case when p_sort = 'role'    and p_dir = 'desc' then role::text   end desc,
    case when p_sort = 'listings' and p_dir = 'asc'  then listing_count end asc,
    case when p_sort = 'listings' and p_dir = 'desc' then listing_count end desc,
    case when p_sort = 'created_at' and p_dir = 'asc'  then created_at end asc,
    case when p_sort = 'created_at' and p_dir = 'desc' then created_at end desc,
    created_at desc
  limit greatest(coalesce(p_limit, 25), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.admin_list_users(
  text, text, boolean, boolean, boolean, text, text, int, int
) from public;

grant execute on function public.admin_list_users(
  text, text, boolean, boolean, boolean, text, text, int, int
) to service_role;

-- ============================================================
-- 20260803190000_search_listings_thumb.sql
-- ============================================================
-- 6.1 — the directory should serve the 30KB cover THUMBNAIL, not the ~250KB
-- original. lib/directory/queries.ts already maps the cover's storage_path to
-- its thumb_path for the current page, so the busiest page serves thumbs today.
--
-- The proper fix is to have search_listings() return the thumbnail directly.
-- That function was created out-of-band (it isn't in this repo's migrations —
-- see docs/02-DATABASE-SCHEMA.sql), so this file documents the one-line change
-- rather than blindly CREATE OR REPLACE-ing a body we don't have here:
--
--   In the cover sub-select inside public.search_listings(...), change:
--       select li.storage_path
--       from public.listing_images li
--       where li.listing_id = l.id
--       order by li.is_cover desc, li.sort_order asc
--       limit 1
--   to:
--       select coalesce(li.thumb_path, li.storage_path)
--       ...
--
-- Apply that edit to the live function definition, then the query-layer lookup
-- in lib/directory/queries.ts becomes a redundant (but harmless) safety net.

-- No-op: intentionally documents the change above without replacing an unknown
-- function body.
select 1;

-- ============================================================
-- 20260803200000_site_urls.sql
-- ============================================================
-- 6.5 — canonical site/admin URLs as settings, so an absolute link never falls
-- back to localhost in production. Seeded with the known production domains
-- (see CLAUDE.md); edit them in Admin → Settings → General.

insert into public.site_settings (key, value, is_public)
values
  ('site_url',  to_jsonb('https://directory.sernaeducationalservices.com'::text), true),
  ('admin_url', to_jsonb('https://admin.sernaeducationalservices.com'::text),     true)
on conflict (key) do nothing;

-- Validation: empty, or a bare origin (scheme + host + optional port). No path,
-- no trailing slash, no query.
create or replace function public.validate_site_url_setting()
returns trigger
language plpgsql
as $$
declare v text;
begin
  if new.key not in ('site_url', 'admin_url') then
    return new;
  end if;
  v := trim(both '"' from new.value::text);
  if v is null or v = '' then
    return new;
  end if;
  if v !~ '^https?://[a-z0-9.-]+(:\d+)?$' then
    raise exception 'Enter a bare URL like https://example.com — no path, no trailing slash, no query.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_site_url on public.site_settings;
create trigger trg_validate_site_url
  before insert or update on public.site_settings
  for each row execute function public.validate_site_url_setting();

-- ============================================================
-- 20260803210000_fix_theme_radius_validator.sql
-- ============================================================
-- Fix: the theme write validator rejected the app's radius format ("16px"),
-- expecting a bare number — so publishing/saving a theme errored with
-- "Theme value radius must be a number 0-99, got 16px". The app stores radius as
-- "Npx" everywhere (toCssVars emits `--radius-card: 16px`), so this replaces the
-- validator to accept that format while keeping the hex-colour checks.
--
-- Replaces the FUNCTION the existing trigger calls (validate_theme_setting), so
-- the trigger keeps working under whatever name it has. Covers theme,
-- theme_draft and admin_theme (4.3).

create or replace function public.validate_theme_setting()
returns trigger
language plpgsql
as $$
declare
  k text;
  v text;
  r text;
begin
  if new.key not in ('theme', 'theme_draft', 'admin_theme') then
    return new;
  end if;

  if jsonb_typeof(new.value) <> 'object' then
    raise exception 'Theme value must be a JSON object.';
  end if;

  -- radius: accept "16px" (what the app writes) or a bare 0-24 number.
  if new.value ? 'radius' then
    r := new.value ->> 'radius';
    if r !~ '^\d{1,2}px$' and r !~ '^\d{1,2}$' then
      raise exception 'Theme radius must look like "16px" (0-24).';
    end if;
  end if;

  -- Any value that looks like a colour (#rrggbb) must be a valid 6-digit hex.
  for k, v in select key, value from jsonb_each_text(new.value)
  loop
    if left(v, 1) = '#' and v !~ '^#[0-9a-fA-F]{6}$' then
      raise exception 'Theme colour "%" must be a 6-digit hex like #201f3a, got %.', k, v;
    end if;
  end loop;

  return new;
end; $$;
