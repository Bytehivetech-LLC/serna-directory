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
