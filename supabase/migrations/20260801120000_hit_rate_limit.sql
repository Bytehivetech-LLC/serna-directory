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
