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
