-- Family Library sharing is intentionally separate from the rest of the portal.
-- A family can join one library circle and see only the names and movie holdings
-- of the other families in that circle. No other feature scope is widened.

create table public.library_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique default upper(substring(md5(random()::text), 1, 8)),
  created_by_family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.library_circle_families (
  circle_id uuid not null references public.library_circles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  joined_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (circle_id, family_id),
  unique (family_id)
);

create table public.family_movies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  tmdb_movie_id integer not null check (tmdb_movie_id > 0),
  title text not null check (length(trim(title)) between 1 and 300),
  original_title text not null default '',
  release_date date,
  poster_path text,
  backdrop_path text,
  overview text not null default '',
  genres text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, tmdb_movie_id),
  check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._/-]+$'),
  check (backdrop_path is null or backdrop_path ~ '^/[A-Za-z0-9._/-]+$')
);

create index family_movies_family_title_idx
  on public.family_movies (family_id, lower(title));

create or replace function public.can_access_library_circle(target_circle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.library_circle_families circle_family
    join public.family_members member
      on member.family_id = circle_family.family_id
    where circle_family.circle_id = target_circle_id
      and member.user_id = (select auth.uid())
  )
$$;

create or replace function public.can_access_library_family(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members member
    where member.family_id = target_family_id
      and member.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.library_circle_families caller_circle
    join public.family_members caller_member
      on caller_member.family_id = caller_circle.family_id
    join public.library_circle_families shared_circle
      on shared_circle.circle_id = caller_circle.circle_id
    where caller_member.user_id = (select auth.uid())
      and shared_circle.family_id = target_family_id
  )
$$;

alter table public.library_circles enable row level security;
alter table public.library_circle_families enable row level security;
alter table public.family_movies enable row level security;

create policy "Circle families can view their library circle"
  on public.library_circles for select to authenticated
  using (public.can_access_library_circle(id));

create policy "Circle families can view circle membership"
  on public.library_circle_families for select to authenticated
  using (public.can_access_library_circle(circle_id));

create policy "Circle families can view shared movies"
  on public.family_movies for select to authenticated
  using (public.can_access_library_family(family_id));

create policy "Family members can add their movies"
  on public.family_movies for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and created_by = (select auth.uid())
  );

create policy "Family members can update their movies"
  on public.family_movies for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "Family members can remove their movies"
  on public.family_movies for delete to authenticated
  using (public.is_family_member(family_id));

grant select (id, name, invite_code, created_by_family_id, created_at)
  on public.library_circles to authenticated;
grant select (circle_id, family_id, joined_at)
  on public.library_circle_families to authenticated;
grant select (
  id, family_id, tmdb_movie_id, title, original_title, release_date,
  poster_path, backdrop_path, overview, genres, created_at, updated_at
) on public.family_movies to authenticated;
grant insert, update, delete on public.family_movies to authenticated;
revoke insert, update, delete on public.library_circles from anon, authenticated;
revoke insert, update, delete on public.library_circle_families from anon, authenticated;

-- Return only public display data for connected families. Do not widen SELECT
-- access on families: that row also contains the main family invite code.
create or replace function public.get_library_families()
returns table (id uuid, name text)
language sql
security definer
stable
set search_path = ''
as $$
  select family.id, family.name
  from public.families family
  where public.can_access_library_family(family.id)
  order by family.name
$$;

revoke all on function public.get_library_families() from public, anon;
grant execute on function public.get_library_families() to authenticated;

create or replace function public.create_library_circle(circle_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_family_id uuid;
  new_circle_id uuid;
begin
  select family_id into caller_family_id
  from public.family_members
  where user_id = caller_id and role = 'admin';

  if caller_family_id is null then
    raise exception 'A family admin is required to create a library circle';
  end if;
  if circle_name is null or length(trim(circle_name)) not between 1 and 80 then
    raise exception 'Circle name must be between 1 and 80 characters';
  end if;
  if exists (
    select 1 from public.library_circle_families
    where family_id = caller_family_id
  ) then
    raise exception 'Your family already belongs to a library circle';
  end if;

  insert into public.library_circles (
    name,
    created_by_family_id,
    created_by_user_id
  ) values (
    trim(circle_name),
    caller_family_id,
    caller_id
  ) returning id into new_circle_id;

  insert into public.library_circle_families (circle_id, family_id, joined_by)
  values (new_circle_id, caller_family_id, caller_id);

  return new_circle_id;
end;
$$;

create or replace function public.join_library_circle(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_family_id uuid;
  target_circle_id uuid;
begin
  select family_id into caller_family_id
  from public.family_members
  where user_id = caller_id and role = 'admin';

  if caller_family_id is null then
    raise exception 'A family admin is required to join a library circle';
  end if;
  if exists (
    select 1 from public.library_circle_families
    where family_id = caller_family_id
  ) then
    raise exception 'Your family already belongs to a library circle';
  end if;

  select id into target_circle_id
  from public.library_circles
  where invite_code = upper(trim(invite_code_input))
  limit 1;

  if target_circle_id is null then
    raise exception 'Invalid library circle invite code';
  end if;

  insert into public.library_circle_families (circle_id, family_id, joined_by)
  values (target_circle_id, caller_family_id, caller_id);

  return target_circle_id;
end;
$$;

create or replace function public.leave_library_circle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_family_id uuid;
  target_circle_id uuid;
begin
  select family_id into caller_family_id
  from public.family_members
  where user_id = caller_id and role = 'admin';

  if caller_family_id is null then
    raise exception 'A family admin is required to leave a library circle';
  end if;

  select circle_id into target_circle_id
  from public.library_circle_families
  where family_id = caller_family_id;

  if target_circle_id is null then
    return;
  end if;

  delete from public.library_circle_families
  where circle_id = target_circle_id and family_id = caller_family_id;

  delete from public.library_circles circle
  where circle.id = target_circle_id
    and not exists (
      select 1 from public.library_circle_families member
      where member.circle_id = circle.id
    );
end;
$$;

revoke all on function public.create_library_circle(text) from public, anon;
revoke all on function public.join_library_circle(text) from public, anon;
revoke all on function public.leave_library_circle() from public, anon;
grant execute on function public.create_library_circle(text) to authenticated;
grant execute on function public.join_library_circle(text) to authenticated;
grant execute on function public.leave_library_circle() to authenticated;

alter publication supabase_realtime add table public.family_movies;
alter publication supabase_realtime add table public.library_circle_families;

-- Case-photo recognition is independently approved and rate limited. The
-- image is sent directly through the Edge Function and is never persisted.
create table public.movie_case_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index movie_case_analysis_requests_user_time_idx
  on public.movie_case_analysis_requests (user_id, created_at desc);

alter table public.movie_case_analysis_requests enable row level security;
revoke all on public.movie_case_analysis_requests from anon, authenticated;

create or replace function public.consume_movie_case_analysis_quota()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  feature_name constant text := 'movie_case_analysis';
  grant_hourly_limit integer;
  grant_daily_limit integer;
  quota_checked_at timestamptz := clock_timestamp();
  hourly_count integer;
  daily_count integer;
  request_id uuid;
begin
  if caller_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text || ':' || feature_name, 0)
  );

  select hourly_limit, daily_limit
    into grant_hourly_limit, grant_daily_limit
  from public.feature_access_grants
  where user_id = caller_id
    and feature = feature_name
    and revoked_at is null;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_approved');
  end if;

  select
    count(*) filter (where created_at >= quota_checked_at - interval '1 hour'),
    count(*)
  into hourly_count, daily_count
  from public.movie_case_analysis_requests
  where user_id = caller_id
    and created_at >= quota_checked_at - interval '24 hours';

  if daily_count >= grant_daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;
  if hourly_count >= grant_hourly_limit then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_limit');
  end if;

  insert into public.movie_case_analysis_requests (user_id, created_at)
  values (caller_id, quota_checked_at)
  returning id into request_id;

  return jsonb_build_object(
    'allowed', true,
    'requestId', request_id,
    'remainingHour', grant_hourly_limit - hourly_count - 1,
    'remainingDay', grant_daily_limit - daily_count - 1
  );
end;
$$;

revoke all on function public.consume_movie_case_analysis_quota() from public, anon;
grant execute on function public.consume_movie_case_analysis_quota() to authenticated;
