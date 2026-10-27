-- CURRENT_TIME is a SQL keyword (time with time zone), even when a PL/pgSQL
-- variable has that name. Use an unambiguous timestamp variable for quota
-- windows, retry delays and ledger entries. Keep existing grants/history intact.
create or replace function public.consume_receipt_analysis_quota()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  receipt_feature constant text := 'receipt_analysis';
  grant_hourly_limit integer;
  grant_daily_limit integer;
  quota_checked_at timestamptz := clock_timestamp();
  hourly_count integer;
  daily_count integer;
  oldest_hourly_request timestamptz;
  oldest_daily_request timestamptz;
  new_request_id uuid;
  retry_after_seconds integer;
begin
  if caller_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  -- Serialize quota checks for this user so concurrent requests cannot both
  -- observe the same remaining slot and exceed the configured limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text || ':' || receipt_feature, 0)
  );

  select hourly_limit, daily_limit
    into grant_hourly_limit, grant_daily_limit
  from public.feature_access_grants
  where user_id = caller_id
    and feature = receipt_feature
    and revoked_at is null;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_approved');
  end if;

  select
    count(*) filter (where created_at >= quota_checked_at - interval '1 hour'),
    count(*),
    min(created_at) filter (where created_at >= quota_checked_at - interval '1 hour'),
    min(created_at)
  into hourly_count, daily_count, oldest_hourly_request, oldest_daily_request
  from public.receipt_analysis_requests
  where user_id = caller_id
    and created_at >= quota_checked_at - interval '24 hours';

  if daily_count >= grant_daily_limit then
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (
        oldest_daily_request + interval '24 hours' - quota_checked_at
      )))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'retryAfterSeconds', retry_after_seconds
    );
  end if;

  if hourly_count >= grant_hourly_limit then
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (
        oldest_hourly_request + interval '1 hour' - quota_checked_at
      )))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'retryAfterSeconds', retry_after_seconds
    );
  end if;

  insert into public.receipt_analysis_requests (user_id, created_at)
  values (caller_id, quota_checked_at)
  returning id into new_request_id;

  return jsonb_build_object(
    'allowed', true,
    'requestId', new_request_id,
    'remainingHour', grant_hourly_limit - hourly_count - 1,
    'remainingDay', grant_daily_limit - daily_count - 1
  );
end;
$$;

comment on function public.consume_receipt_analysis_quota() is
  'Atomically verifies an active receipt_analysis grant and reserves one per-user quota slot.';

revoke all on function public.consume_receipt_analysis_quota() from public, anon;
grant execute on function public.consume_receipt_analysis_quota() to authenticated;
