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
