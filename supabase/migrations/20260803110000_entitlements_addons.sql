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
