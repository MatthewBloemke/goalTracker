-- A user has one active budget scope at a time: their personal scope when they
-- have no family membership, or their family's shared scope while they do.
-- Personal rows remain untouched when membership changes.

create unique index if not exists family_members_one_family_per_user
  on public.family_members(user_id);

create policy "Members can leave their family"
  on public.family_members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- A family debt belongs to the family scope, even when the member who first
-- entered it later leaves. Personal debts remain visible only to their owner.
drop policy if exists "Users can view their own loans" on public.loans;
drop policy if exists "Users can insert their own loans" on public.loans;
drop policy if exists "Owners and family members can update loans" on public.loans;
drop policy if exists "Owners and family members can delete loans" on public.loans;

create policy "Users can view accessible loans"
  on public.loans for select to authenticated
  using (public.can_access_budget_scope(user_id, family_id));

create policy "Users can create accessible loans"
  on public.loans for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.can_access_budget_scope(user_id, family_id)
  );

create policy "Users can update accessible loans"
  on public.loans for update to authenticated
  using (public.can_access_budget_scope(user_id, family_id))
  with check (public.can_access_budget_scope(user_id, family_id));

create policy "Users can delete accessible loans"
  on public.loans for delete to authenticated
  using (public.can_access_budget_scope(user_id, family_id));

drop policy if exists "Users can view payments on visible loans" on public.payments;
drop policy if exists "Owners and family members can add payments" on public.payments;

create policy "Users can view payments on accessible loans"
  on public.payments for select to authenticated
  using (
    exists (
      select 1
      from public.loans loan
      where loan.id = payments.loan_id
        and public.can_access_budget_scope(loan.user_id, loan.family_id)
    )
  );

create policy "Users can add payments to accessible loans"
  on public.payments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.loans loan
      where loan.id = payments.loan_id
        and public.can_access_budget_scope(loan.user_id, loan.family_id)
    )
  );
