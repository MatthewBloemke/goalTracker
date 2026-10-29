-- Track each physical movie format as its own lendable copy and retain a
-- timestamped loan history. This migration is separate so it is safe whether
-- the initial Family Library migration has already been deployed or not.

create type public.movie_media_format as enum ('dvd', 'blu_ray', '4k_uhd');

alter table public.family_movies
  add column media_format public.movie_media_format not null default 'dvd';

alter table public.family_movies
  drop constraint if exists family_movies_family_id_tmdb_movie_id_key;

alter table public.family_movies
  add constraint family_movies_family_movie_format_key
  unique (family_id, tmdb_movie_id, media_format);

create table public.movie_loans (
  id uuid primary key default gen_random_uuid(),
  family_movie_id uuid not null references public.family_movies(id) on delete cascade,
  borrower_family_id uuid not null references public.families(id) on delete restrict,
  borrower_family_name text not null check (char_length(borrower_family_name) between 1 and 100),
  borrowed_at timestamptz not null default now(),
  returned_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (returned_at is null or returned_at >= borrowed_at)
);

create unique index movie_loans_one_active_per_copy_idx
  on public.movie_loans (family_movie_id)
  where returned_at is null;

create index movie_loans_copy_history_idx
  on public.movie_loans (family_movie_id, borrowed_at desc);

alter table public.movie_loans enable row level security;

create policy "Library circles can view shared movie loans"
  on public.movie_loans for select to authenticated
  using (
    exists (
      select 1
      from public.family_movies movie
      where movie.id = movie_loans.family_movie_id
        and public.can_access_library_family(movie.family_id)
    )
  );

grant select (
  id, family_movie_id, borrower_family_id, borrower_family_name, borrowed_at,
  returned_at, created_at, updated_at
) on public.movie_loans to authenticated;
revoke insert, update, delete on public.movie_loans from anon, authenticated;

create or replace function public.lend_family_movie(
  copy_id uuid,
  borrower_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_family_id uuid;
  owner_family_id uuid;
  borrower_name text;
  new_loan_id uuid;
begin
  select family_id into caller_family_id
  from public.family_members
  where user_id = caller_id;

  if caller_family_id is null then
    raise exception 'A family membership is required to lend a movie';
  end if;

  select family_id into owner_family_id
  from public.family_movies
  where id = copy_id;

  if owner_family_id is null or owner_family_id <> caller_family_id then
    raise exception 'Only the owning family can lend this movie copy';
  end if;
  if borrower_id = owner_family_id then
    raise exception 'Choose another family as the borrower';
  end if;
  if not public.can_access_library_family(borrower_id) then
    raise exception 'The borrower must belong to your library circle';
  end if;
  select name into borrower_name
  from public.families
  where id = borrower_id;
  if borrower_name is null then
    raise exception 'The borrowing family was not found';
  end if;
  if exists (
    select 1 from public.movie_loans
    where family_movie_id = copy_id and returned_at is null
  ) then
    raise exception 'This movie copy is already borrowed';
  end if;

  insert into public.movie_loans (
    family_movie_id,
    borrower_family_id,
    borrower_family_name,
    created_by
  ) values (
    copy_id,
    borrower_id,
    borrower_name,
    caller_id
  ) returning id into new_loan_id;

  return new_loan_id;
end;
$$;

create or replace function public.return_family_movie(loan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_family_id uuid;
  affected_rows integer;
begin
  select family_id into caller_family_id
  from public.family_members
  where user_id = caller_id;

  if caller_family_id is null then
    raise exception 'A family membership is required to return a movie';
  end if;

  update public.movie_loans loan
  set returned_at = clock_timestamp(),
      returned_by = caller_id,
      updated_at = clock_timestamp()
  from public.family_movies movie
  where loan.id = loan_id
    and loan.family_movie_id = movie.id
    and movie.family_id = caller_family_id
    and loan.returned_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'This active loan was not found for your family';
  end if;
end;
$$;

revoke all on function public.lend_family_movie(uuid, uuid) from public, anon;
revoke all on function public.return_family_movie(uuid) from public, anon;
grant execute on function public.lend_family_movie(uuid, uuid) to authenticated;
grant execute on function public.return_family_movie(uuid) to authenticated;

alter publication supabase_realtime add table public.movie_loans;

-- Replace the earlier safe-column grant so connected families can see the
-- required physical format but still cannot see creator user IDs.
grant select (media_format) on public.family_movies to authenticated;
