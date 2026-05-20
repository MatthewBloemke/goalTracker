-- ============================================================
-- EXTENSIONS
-- ============================================================

-- ============================================================
-- PROFILES
-- Auto-created when a user signs up via Google Auth
-- ============================================================
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- FAMILIES
-- A group that shares visibility into each other's debt
-- ============================================================
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete restrict,
  invite_code text not null unique default upper(substring(md5(random()::text), 1, 8)),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- FAMILY MEMBERS
-- Junction table — users belong to families with a role
-- ============================================================
create type family_role as enum ('admin', 'member');

create table public.family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        family_role not null default 'member',
  joined_at   timestamptz not null default now(),
  unique(family_id, user_id)
);

-- ============================================================
-- LOANS
-- A single debt/loan belonging to a user, optionally shared
-- with a family group
-- ============================================================
create type snowball_strategy as enum ('snowball', 'avalanche');

create table public.loans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  family_id        uuid references public.families(id) on delete set null,
  name             text not null,
  lender           text,
  original_amount  numeric(12,2) not null check (original_amount > 0),
  current_balance  numeric(12,2) not null check (current_balance >= 0),
  interest_rate    numeric(6,4) not null check (interest_rate >= 0), -- stored as decimal e.g. 0.0525 = 5.25%
  min_payment      numeric(10,2) not null check (min_payment > 0),
  snowball_order   int,           -- manually overridable sort order
  is_active        boolean not null default true,
  paid_off_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS
-- Every payment made against a loan
-- ============================================================
create type payment_type as enum ('minimum', 'extra', 'manual');

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  loan_id       uuid not null references public.loans(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount        numeric(10,2) not null check (amount > 0),
  type          payment_type not null,
  note          text,
  balance_after numeric(12,2) not null,
  paid_at       timestamptz not null default now()
);

-- ============================================================
-- FAMILY SETTINGS
-- Per-family configuration (strategy, extra monthly budget, etc.)
-- ============================================================
create table public.family_settings (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null unique references public.families(id) on delete cascade,
  strategy            snowball_strategy not null default 'snowball',
  extra_monthly_budget numeric(10,2) not null default 0,
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger loans_updated_at
  before update on public.loans
  for each row execute function public.handle_updated_at();

create trigger family_settings_updated_at
  before update on public.family_settings
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.loans          enable row level security;
alter table public.payments       enable row level security;
alter table public.family_settings enable row level security;

-- ---- PROFILES ----
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- ---- FAMILIES ----
-- Users can see families they belong to
create policy "Members can view their family"
  on public.families for select
  using (
    exists (
      select 1 from public.family_members
      where family_id = families.id and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create a family"
  on public.families for insert
  with check (auth.uid() = created_by);

create policy "Admins can update their family"
  on public.families for update
  using (
    exists (
      select 1 from public.family_members
      where family_id = families.id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ---- FAMILY MEMBERS ----
create policy "Members can view their family members"
  on public.family_members for select
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
        and fm.user_id = auth.uid()
    )
  );

create policy "Users can join a family (insert themselves)"
  on public.family_members for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage family members"
  on public.family_members for delete
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

-- ---- LOANS ----
-- Users can see their own loans OR loans from families they belong to
create policy "Users can view their own loans"
  on public.loans for select
  using (
    auth.uid() = user_id
    or (
      family_id is not null and exists (
        select 1 from public.family_members
        where family_id = loans.family_id and user_id = auth.uid()
      )
    )
  );

create policy "Users can insert their own loans"
  on public.loans for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own loans"
  on public.loans for update
  using (auth.uid() = user_id);

create policy "Users can delete their own loans"
  on public.loans for delete
  using (auth.uid() = user_id);

-- ---- PAYMENTS ----
create policy "Users can view payments on visible loans"
  on public.payments for select
  using (
    exists (
      select 1 from public.loans
      where loans.id = payments.loan_id
        and (
          loans.user_id = auth.uid()
          or (
            loans.family_id is not null and exists (
              select 1 from public.family_members
              where family_id = loans.family_id and user_id = auth.uid()
            )
          )
        )
    )
  );

create policy "Users can insert payments on their own loans"
  on public.payments for insert
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.loans
      where id = payments.loan_id and user_id = auth.uid()
    )
  );

-- ---- FAMILY SETTINGS ----
create policy "Members can view family settings"
  on public.family_settings for select
  using (
    exists (
      select 1 from public.family_members
      where family_id = family_settings.family_id and user_id = auth.uid()
    )
  );

create policy "Admins can manage family settings"
  on public.family_settings for all
  using (
    exists (
      select 1 from public.family_members
      where family_id = family_settings.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ============================================================
-- REALTIME
-- Enable realtime on tables that need live updates
-- ============================================================
alter publication supabase_realtime add table public.loans;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.family_members;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_loans_user_id       on public.loans(user_id);
create index idx_loans_family_id     on public.loans(family_id);
create index idx_payments_loan_id    on public.payments(loan_id);
create index idx_family_members_user on public.family_members(user_id);
create index idx_family_members_fam  on public.family_members(family_id);