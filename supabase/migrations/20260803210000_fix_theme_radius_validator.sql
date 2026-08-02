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
