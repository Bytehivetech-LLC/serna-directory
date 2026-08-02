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
