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
