-- Family Portal requires every feature record to belong to a family. Existing
-- personal rows are retained for safety, but RLS no longer exposes them and
-- NOT VALID checks prevent any new personal rows without requiring a
-- destructive cleanup migration.

create or replace function public.can_access_budget_scope(owner_id uuid, fam_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select fam_id is not null and public.is_family_member(fam_id)
$$;

create or replace function public.can_access_portal_scope(owner_id uuid, fam_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select fam_id is not null and public.is_family_member(fam_id)
$$;

alter table public.loans
  add constraint loans_require_family check (family_id is not null) not valid;
alter table public.budget_groups
  add constraint budget_groups_require_family check (family_id is not null) not valid;
alter table public.monthly_budgets
  add constraint monthly_budgets_require_family check (family_id is not null) not valid;
alter table public.budget_transactions
  add constraint budget_transactions_require_family check (family_id is not null) not valid;
alter table public.task_lists
  add constraint task_lists_require_family check (family_id is not null) not valid;
alter table public.recipes
  add constraint recipes_require_family check (family_id is not null) not valid;
alter table public.meal_plan_entries
  add constraint meal_plan_entries_require_family check (family_id is not null) not valid;

-- These RPCs make onboarding atomic and keep invite codes out of broad SELECT
-- policies. A user may belong to exactly one family (enforced by the existing
-- family_members_one_family_per_user index).
create or replace function public.create_family_for_current_user(family_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_family_id uuid;
begin
  if caller is null then
    raise exception 'Sign in to create a family';
  end if;
  if family_name is null or length(trim(family_name)) not between 1 and 100 then
    raise exception 'Family name must be between 1 and 100 characters';
  end if;
  if exists (select 1 from public.family_members where user_id = caller) then
    raise exception 'You already belong to a family';
  end if;

  insert into public.families (name, created_by)
  values (trim(family_name), caller)
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, caller, 'admin');

  insert into public.family_settings (
    family_id,
    strategy,
    extra_monthly_budget
  ) values (
    new_family_id,
    'snowball',
    0
  );

  return new_family_id;
end;
$$;

create or replace function public.join_family_with_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_family_id uuid;
begin
  if caller is null then
    raise exception 'Sign in to join a family';
  end if;
  if exists (select 1 from public.family_members where user_id = caller) then
    raise exception 'You already belong to a family';
  end if;

  select id into target_family_id
  from public.families
  where invite_code = upper(trim(invite_code_input))
  limit 1;

  if target_family_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (target_family_id, caller, 'member');

  return target_family_id;
end;
$$;

revoke all on function public.create_family_for_current_user(text) from public, anon;
revoke all on function public.join_family_with_invite(text) from public, anon;
grant execute on function public.create_family_for_current_user(text) to authenticated;
grant execute on function public.join_family_with_invite(text) to authenticated;

drop policy if exists "Authenticated users can create a family" on public.families;
drop policy if exists "Authenticated users can look up family by invite code" on public.families;
drop policy if exists "Users can join a family (insert themselves)" on public.family_members;
