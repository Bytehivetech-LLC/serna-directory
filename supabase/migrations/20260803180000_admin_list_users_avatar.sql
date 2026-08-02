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
