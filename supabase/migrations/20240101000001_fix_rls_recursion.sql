-- ============================================================
-- FIX: Infinite recursion in family_members RLS policies
-- Solution: use a SECURITY DEFINER helper function that bypasses
-- RLS when checking membership, breaking the recursive loop
-- ============================================================

-- Helper function — runs as the function owner (bypasses RLS)
create or replace function public.is_family_member(fam_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_family_admin(fam_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam_id and user_id = auth.uid() and role = 'admin'
  )
$$;

-- ---- Drop old recursive policies ----
drop policy if exists "Members can view their family members" on public.family_members;
drop policy if exists "Users can join a family (insert themselves)" on public.family_members;
drop policy if exists "Admins can manage family members" on public.family_members;

drop policy if exists "Members can view their family" on public.families;
drop policy if exists "Admins can update their family" on public.families;

drop policy if exists "Members can view family settings" on public.family_settings;
drop policy if exists "Admins can manage family settings" on public.family_settings;

drop policy if exists "Users can view their own loans" on public.loans;

-- ---- Recreate using helper functions ----

-- FAMILY_MEMBERS
create policy "Members can view their family members"
  on public.family_members for select
  using (public.is_family_member(family_id));

create policy "Users can join a family (insert themselves)"
  on public.family_members for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage family members"
  on public.family_members for delete
  using (public.is_family_admin(family_id));

-- FAMILIES
create policy "Members can view their family"
  on public.families for select
  using (public.is_family_member(id));

create policy "Admins can update their family"
  on public.families for update
  using (public.is_family_admin(id));

-- FAMILY SETTINGS
create policy "Members can view family settings"
  on public.family_settings for select
  using (public.is_family_member(family_id));

create policy "Admins can manage family settings"
  on public.family_settings for all
  using (public.is_family_admin(family_id));

-- LOANS (also had a recursive family check)
drop policy if exists "Users can view their own loans" on public.loans;

create policy "Users can view their own loans"
  on public.loans for select
  using (
    auth.uid() = user_id
    or (
      family_id is not null
      and public.is_family_member(family_id)
    )
  );
