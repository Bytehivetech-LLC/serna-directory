-- Round 2 #7 — admin-configurable logo heights (px), one per placement.
-- Seeded with the current hardcoded values so nothing changes on upgrade.

insert into public.site_settings (key, value, is_public)
values
  ('logo_height_header', to_jsonb(32), true),
  ('logo_height_footer', to_jsonb(28), true),
  ('logo_height_auth',   to_jsonb(40), true)
on conflict (key) do nothing;

-- Validate the three numeric settings server-side too (like the other numeric
-- settings): integer within the documented range.
create or replace function public.validate_logo_size_setting()
returns trigger
language plpgsql
as $$
declare n numeric;
begin
  if new.key not in ('logo_height_header', 'logo_height_footer', 'logo_height_auth') then
    return new;
  end if;
  if jsonb_typeof(new.value) <> 'number' then
    raise exception 'Logo height must be a whole number of pixels.';
  end if;
  n := (new.value)::text::numeric;
  if n <> floor(n) then
    raise exception 'Logo height must be a whole number of pixels.';
  end if;
  if new.key = 'logo_height_header' and (n < 20 or n > 64) then
    raise exception 'Header logo height must be 20-64px.';
  elsif new.key = 'logo_height_footer' and (n < 20 or n > 56) then
    raise exception 'Footer logo height must be 20-56px.';
  elsif new.key = 'logo_height_auth' and (n < 24 or n > 80) then
    raise exception 'Auth logo height must be 24-80px.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_logo_size on public.site_settings;
create trigger trg_validate_logo_size
  before insert or update on public.site_settings
  for each row execute function public.validate_logo_size_setting();
