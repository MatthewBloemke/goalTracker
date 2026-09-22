-- ============================================================
-- RECEIPT ANALYSIS ACCESS AND COST CONTROLS
-- Deny-by-default feature grants plus an atomic, per-user quota
-- consumed immediately before a paid receipt-analysis request.
-- ============================================================

create table public.feature_access_grants (
  user_id      uuid not null references auth.users(id) on delete cascade,
  feature      text not null check (feature ~ '^[a-z][a-z0-9_]{2,63}$'),
  hourly_limit integer not null default 10 check (hourly_limit between 1 and 1000),
  daily_limit  integer not null default 30 check (daily_limit between 1 and 10000),
  granted_by   uuid references auth.users(id) on delete set null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  primary key (user_id, feature),
  check (hourly_limit <= daily_limit)
);

comment on table public.feature_access_grants is
  'Administrator-managed feature entitlements. Absence of an active row denies access.';
comment on column public.feature_access_grants.hourly_limit is
  'Maximum feature requests in a sliding one-hour window.';
comment on column public.feature_access_grants.daily_limit is
  'Maximum feature requests in a sliding 24-hour window.';

create table public.receipt_analysis_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index receipt_analysis_requests_user_created_at_idx
  on public.receipt_analysis_requests (user_id, created_at desc);

comment on table public.receipt_analysis_requests is
  'Server-managed quota ledger. Contains request metadata only, never receipt images or extracted data.';

alter table public.feature_access_grants enable row level security;
alter table public.receipt_analysis_requests enable row level security;

create policy "Users can view their own feature grants"
  on public.feature_access_grants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.feature_access_grants to authenticated;
revoke insert, update, delete on public.feature_access_grants from anon, authenticated;
revoke all on public.receipt_analysis_requests from anon, authenticated;

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
  current_time timestamptz := clock_timestamp();
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
    count(*) filter (where created_at >= current_time - interval '1 hour'),
    count(*),
    min(created_at) filter (where created_at >= current_time - interval '1 hour'),
    min(created_at)
  into hourly_count, daily_count, oldest_hourly_request, oldest_daily_request
  from public.receipt_analysis_requests
  where user_id = caller_id
    and created_at >= current_time - interval '24 hours';

  if daily_count >= grant_daily_limit then
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (
        oldest_daily_request + interval '24 hours' - current_time
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
        oldest_hourly_request + interval '1 hour' - current_time
      )))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'retryAfterSeconds', retry_after_seconds
    );
  end if;

  insert into public.receipt_analysis_requests (user_id, created_at)
  values (caller_id, current_time)
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
