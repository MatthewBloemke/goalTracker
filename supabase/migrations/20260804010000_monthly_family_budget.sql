-- ============================================================
-- FAMILY PORTAL MONTHLY BUDGET
-- Zero-based monthly plans, category groups, split transactions,
-- surplus rollover, debt integration, RLS, and realtime.
-- ============================================================

create table public.budget_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  family_id   uuid references public.families(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  sort_order  integer not null default 0,
  is_system   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.budget_categories (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.budget_groups(id) on delete cascade,
  loan_id     uuid unique references public.loans(id) on delete set null,
  name        text not null check (length(trim(name)) > 0),
  sort_order  integer not null default 0,
  is_system   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.monthly_budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  family_id   uuid references public.families(id) on delete cascade,
  month       date not null check (month = date_trunc('month', month)::date),
  income      numeric(12,2) not null default 0 check (income >= 0),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index monthly_budgets_family_month_unique
  on public.monthly_budgets(family_id, month)
  where family_id is not null;

create unique index monthly_budgets_personal_month_unique
  on public.monthly_budgets(user_id, month)
  where family_id is null;

create table public.monthly_budget_allocations (
  id                uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets(id) on delete cascade,
  category_id       uuid not null references public.budget_categories(id) on delete restrict,
  planned_amount    numeric(12,2) not null default 0 check (planned_amount >= 0),
  rollover_amount   numeric(12,2) not null default 0 check (rollover_amount >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(monthly_budget_id, category_id)
);

create table public.budget_transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  family_id            uuid references public.families(id) on delete cascade,
  created_by           uuid not null references auth.users(id) on delete restrict,
  amount               numeric(12,2) not null check (amount > 0),
  occurred_on          date not null default current_date,
  merchant             text not null check (length(trim(merchant)) > 0),
  note                 text,
  source               text not null default 'manual',
  payment_id           uuid unique references public.payments(id) on delete set null,
  receipt_storage_path text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.budget_transaction_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.budget_transactions(id) on delete cascade,
  category_id    uuid not null references public.budget_categories(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  created_at     timestamptz not null default now(),
  unique(transaction_id, category_id)
);

create trigger budget_groups_updated_at before update on public.budget_groups
  for each row execute function public.handle_updated_at();
create trigger budget_categories_updated_at before update on public.budget_categories
  for each row execute function public.handle_updated_at();
create trigger monthly_budgets_updated_at before update on public.monthly_budgets
  for each row execute function public.handle_updated_at();
create trigger monthly_budget_allocations_updated_at before update on public.monthly_budget_allocations
  for each row execute function public.handle_updated_at();
create trigger budget_transactions_updated_at before update on public.budget_transactions
  for each row execute function public.handle_updated_at();

-- A row belongs either to its creator's personal scope or a family scope.
create or replace function public.can_access_budget_scope(owner_id uuid, fam_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (fam_id is null and owner_id = (select auth.uid()))
    or (fam_id is not null and public.is_family_member(fam_id))
$$;

grant execute on function public.can_access_budget_scope(uuid, uuid) to authenticated;

alter table public.budget_groups enable row level security;
alter table public.budget_categories enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.monthly_budget_allocations enable row level security;
alter table public.budget_transactions enable row level security;
alter table public.budget_transaction_splits enable row level security;

create policy "Members can view budget groups" on public.budget_groups for select to authenticated
  using (public.can_access_budget_scope(user_id, family_id));
create policy "Members can create budget groups" on public.budget_groups for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_budget_scope(user_id, family_id));
create policy "Members can update budget groups" on public.budget_groups for update to authenticated
  using (not is_system and public.can_access_budget_scope(user_id, family_id))
  with check (not is_system and public.can_access_budget_scope(user_id, family_id));
create policy "Members can delete budget groups" on public.budget_groups for delete to authenticated
  using (not is_system and public.can_access_budget_scope(user_id, family_id));

create policy "Members can view budget categories" on public.budget_categories for select to authenticated
  using (exists (select 1 from public.budget_groups g where g.id = group_id and public.can_access_budget_scope(g.user_id, g.family_id)));
create policy "Members can create budget categories" on public.budget_categories for insert to authenticated
  with check (exists (select 1 from public.budget_groups g where g.id = group_id and public.can_access_budget_scope(g.user_id, g.family_id)));
create policy "Members can update budget categories" on public.budget_categories for update to authenticated
  using (not is_system and exists (select 1 from public.budget_groups g where g.id = group_id and public.can_access_budget_scope(g.user_id, g.family_id)))
  with check (not is_system and exists (select 1 from public.budget_groups g where g.id = group_id and public.can_access_budget_scope(g.user_id, g.family_id)));
create policy "Members can delete budget categories" on public.budget_categories for delete to authenticated
  using (not is_system and exists (select 1 from public.budget_groups g where g.id = group_id and public.can_access_budget_scope(g.user_id, g.family_id)));

create policy "Members can view monthly budgets" on public.monthly_budgets for select to authenticated
  using (public.can_access_budget_scope(user_id, family_id));
create policy "Members can create monthly budgets" on public.monthly_budgets for insert to authenticated
  with check ((select auth.uid()) = created_by and public.can_access_budget_scope(user_id, family_id));
create policy "Members can update monthly budgets" on public.monthly_budgets for update to authenticated
  using (public.can_access_budget_scope(user_id, family_id))
  with check (public.can_access_budget_scope(user_id, family_id));
create policy "Members can delete monthly budgets" on public.monthly_budgets for delete to authenticated
  using (public.can_access_budget_scope(user_id, family_id));

create policy "Members can view allocations" on public.monthly_budget_allocations for select to authenticated
  using (exists (select 1 from public.monthly_budgets b where b.id = monthly_budget_id and public.can_access_budget_scope(b.user_id, b.family_id)));
create policy "Members can create allocations" on public.monthly_budget_allocations for insert to authenticated
  with check (exists (select 1 from public.monthly_budgets b where b.id = monthly_budget_id and public.can_access_budget_scope(b.user_id, b.family_id)));
create policy "Members can update allocations" on public.monthly_budget_allocations for update to authenticated
  using (exists (select 1 from public.monthly_budgets b where b.id = monthly_budget_id and public.can_access_budget_scope(b.user_id, b.family_id)))
  with check (exists (select 1 from public.monthly_budgets b where b.id = monthly_budget_id and public.can_access_budget_scope(b.user_id, b.family_id)));
create policy "Members can delete allocations" on public.monthly_budget_allocations for delete to authenticated
  using (exists (select 1 from public.monthly_budgets b where b.id = monthly_budget_id and public.can_access_budget_scope(b.user_id, b.family_id)));

create policy "Members can view transactions" on public.budget_transactions for select to authenticated
  using (public.can_access_budget_scope(user_id, family_id));
create policy "Members can create transactions" on public.budget_transactions for insert to authenticated
  with check ((select auth.uid()) = created_by and public.can_access_budget_scope(user_id, family_id));
create policy "Members can update transactions" on public.budget_transactions for update to authenticated
  using (public.can_access_budget_scope(user_id, family_id))
  with check (public.can_access_budget_scope(user_id, family_id));
create policy "Members can delete transactions" on public.budget_transactions for delete to authenticated
  using (public.can_access_budget_scope(user_id, family_id));

create policy "Members can view transaction splits" on public.budget_transaction_splits for select to authenticated
  using (exists (select 1 from public.budget_transactions t where t.id = transaction_id and public.can_access_budget_scope(t.user_id, t.family_id)));
create policy "Members can create transaction splits" on public.budget_transaction_splits for insert to authenticated
  with check (exists (select 1 from public.budget_transactions t where t.id = transaction_id and public.can_access_budget_scope(t.user_id, t.family_id)));
create policy "Members can update transaction splits" on public.budget_transaction_splits for update to authenticated
  using (exists (select 1 from public.budget_transactions t where t.id = transaction_id and public.can_access_budget_scope(t.user_id, t.family_id)))
  with check (exists (select 1 from public.budget_transactions t where t.id = transaction_id and public.can_access_budget_scope(t.user_id, t.family_id)));
create policy "Members can delete transaction splits" on public.budget_transaction_splits for delete to authenticated
  using (exists (select 1 from public.budget_transactions t where t.id = transaction_id and public.can_access_budget_scope(t.user_id, t.family_id)));

grant all on public.budget_groups to authenticated;
grant all on public.budget_categories to authenticated;
grant all on public.monthly_budgets to authenticated;
grant all on public.monthly_budget_allocations to authenticated;
grant all on public.budget_transactions to authenticated;
grant all on public.budget_transaction_splits to authenticated;

create index budget_groups_scope_idx on public.budget_groups(family_id, user_id);
create index budget_categories_group_idx on public.budget_categories(group_id);
create index monthly_budgets_scope_month_idx on public.monthly_budgets(family_id, user_id, month);
create index monthly_budget_allocations_budget_idx on public.monthly_budget_allocations(monthly_budget_id);
create index budget_transactions_scope_date_idx on public.budget_transactions(family_id, user_id, occurred_on desc);
create index budget_transaction_splits_transaction_idx on public.budget_transaction_splits(transaction_id);
create index budget_transaction_splits_category_idx on public.budget_transaction_splits(category_id);

-- Copy a plan into another month. Current-income assignments are copied as-is;
-- only positive unused category balances become separately visible rollover.
create or replace function public.copy_budget_month(source_budget_id uuid, target_month date)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_budget public.monthly_budgets%rowtype;
  new_budget_id uuid;
begin
  if target_month <> date_trunc('month', target_month)::date then
    raise exception 'Target month must be the first day of a month';
  end if;

  select * into source_budget from public.monthly_budgets where id = source_budget_id;
  if not found then raise exception 'Source budget not found'; end if;

  insert into public.monthly_budgets (user_id, family_id, month, income, created_by)
  values (source_budget.user_id, source_budget.family_id, target_month, source_budget.income, (select auth.uid()))
  returning id into new_budget_id;

  insert into public.monthly_budget_allocations (
    monthly_budget_id, category_id, planned_amount, rollover_amount
  )
  select
    new_budget_id,
    allocation.category_id,
    allocation.planned_amount,
    greatest(
      allocation.planned_amount + allocation.rollover_amount - coalesce(spending.amount, 0),
      0
    )
  from public.monthly_budget_allocations allocation
  left join lateral (
    select sum(split.amount) as amount
    from public.budget_transaction_splits split
    join public.budget_transactions transaction on transaction.id = split.transaction_id
    where split.category_id = allocation.category_id
      and transaction.occurred_on >= source_budget.month
      and transaction.occurred_on < (source_budget.month + interval '1 month')::date
  ) spending on true
  where allocation.monthly_budget_id = source_budget.id;

  return new_budget_id;
end;
$$;

grant execute on function public.copy_budget_month(uuid, date) to authenticated;

-- Insert a transaction and all category splits in one database transaction.
create or replace function public.create_budget_transaction(
  owner_id uuid,
  fam_id uuid,
  transaction_amount numeric,
  transaction_date date,
  transaction_merchant text,
  transaction_note text,
  category_splits jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_transaction_id uuid;
  split_total numeric;
begin
  if owner_id <> (select auth.uid()) then raise exception 'Owner must be the current user'; end if;
  if transaction_amount <= 0 then raise exception 'Transaction amount must be positive'; end if;
  if length(trim(transaction_merchant)) = 0 then raise exception 'Merchant is required'; end if;

  select coalesce(sum((split->>'amount')::numeric), 0)
    into split_total
  from jsonb_array_elements(category_splits) split;

  if round(split_total, 2) <> round(transaction_amount, 2) then
    raise exception 'Category splits must equal the transaction amount';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(category_splits) split
    left join public.budget_categories category on category.id = (split->>'category_id')::uuid
    left join public.budget_groups budget_group on budget_group.id = category.group_id
    where category.id is null
      or budget_group.family_id is distinct from fam_id
      or (fam_id is null and budget_group.user_id <> owner_id)
  ) then
    raise exception 'A category does not belong to this budget';
  end if;

  insert into public.budget_transactions (
    user_id, family_id, created_by, amount, occurred_on, merchant, note
  ) values (
    owner_id, fam_id, (select auth.uid()), transaction_amount,
    transaction_date, trim(transaction_merchant), nullif(trim(transaction_note), '')
  ) returning id into new_transaction_id;

  insert into public.budget_transaction_splits (transaction_id, category_id, amount)
  select
    new_transaction_id,
    (split->>'category_id')::uuid,
    (split->>'amount')::numeric
  from jsonb_array_elements(category_splits) split;

  return new_transaction_id;
end;
$$;

grant execute on function public.create_budget_transaction(uuid, uuid, numeric, date, text, text, jsonb) to authenticated;

-- Every loan gets a protected category under a protected Debt group.
create or replace function public.sync_budget_debt_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_group_id uuid;
begin
  select id into debt_group_id
  from public.budget_groups
  where name = 'Debt'
    and is_system = true
    and family_id is not distinct from new.family_id
    and (new.family_id is not null or user_id = new.user_id)
  order by created_at
  limit 1;

  if debt_group_id is null then
    insert into public.budget_groups (user_id, family_id, name, sort_order, is_system)
    values (new.user_id, new.family_id, 'Debt', 1000, true)
    returning id into debt_group_id;
  end if;

  insert into public.budget_categories (group_id, loan_id, name, is_system)
  values (debt_group_id, new.id, new.name, true)
  on conflict (loan_id) do update
    set group_id = excluded.group_id,
        name = excluded.name,
        archived_at = case when new.is_active then null else now() end;

  return new;
end;
$$;

create trigger sync_loan_budget_category
  after insert or update of name, family_id, user_id, is_active on public.loans
  for each row execute function public.sync_budget_debt_category();

-- Backfill the protected Debt groups/categories for existing loans.
insert into public.budget_groups (user_id, family_id, name, sort_order, is_system)
select distinct on (coalesce(loan.family_id, loan.user_id))
  loan.user_id, loan.family_id, 'Debt', 1000, true
from public.loans loan
where not exists (
  select 1 from public.budget_groups existing_group
  where existing_group.name = 'Debt'
    and existing_group.is_system = true
    and existing_group.family_id is not distinct from loan.family_id
    and (loan.family_id is not null or existing_group.user_id = loan.user_id)
)
order by coalesce(loan.family_id, loan.user_id), loan.created_at;

insert into public.budget_categories (group_id, loan_id, name, is_system, archived_at)
select debt_group.id, loan.id, loan.name, true,
  case when loan.is_active then null else now() end
from public.loans loan
join public.budget_groups debt_group
  on debt_group.name = 'Debt'
  and debt_group.is_system = true
  and debt_group.family_id is not distinct from loan.family_id
  and (loan.family_id is not null or debt_group.user_id = loan.user_id)
on conflict (loan_id) do update
  set group_id = excluded.group_id,
      name = excluded.name,
      archived_at = excluded.archived_at;

-- Convert a loan payment into a categorized budget transaction atomically.
create or replace function public.track_debt_payment_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_loan public.loans%rowtype;
  category_id uuid;
  transaction_id uuid;
begin
  select * into source_loan from public.loans where id = new.loan_id;
  select id into category_id from public.budget_categories where loan_id = new.loan_id;

  if category_id is null then return new; end if;

  insert into public.budget_transactions (
    user_id, family_id, created_by, amount, occurred_on, merchant, note, source, payment_id
  ) values (
    source_loan.user_id,
    source_loan.family_id,
    new.user_id,
    new.amount,
    new.paid_at::date,
    coalesce(source_loan.lender, source_loan.name),
    coalesce(new.note, 'Debt payment'),
    'debt_payment',
    new.id
  )
  on conflict (payment_id) do nothing
  returning id into transaction_id;

  if transaction_id is not null then
    insert into public.budget_transaction_splits (transaction_id, category_id, amount)
    values (transaction_id, category_id, new.amount);
  end if;

  return new;
end;
$$;

create trigger track_debt_payment_in_budget
  after insert on public.payments
  for each row execute function public.track_debt_payment_transaction();

-- Family budgets are collaborative, including recording a payment against a
-- loan that another family member originally entered.
drop policy if exists "Users can update their own loans" on public.loans;
drop policy if exists "Users can delete their own loans" on public.loans;
drop policy if exists "Users can insert payments on their own loans" on public.payments;

create policy "Owners and family members can update loans"
  on public.loans for update to authenticated
  using ((select auth.uid()) = user_id or (family_id is not null and public.is_family_member(family_id)))
  with check ((select auth.uid()) = user_id or (family_id is not null and public.is_family_member(family_id)));

create policy "Owners and family members can delete loans"
  on public.loans for delete to authenticated
  using ((select auth.uid()) = user_id or (family_id is not null and public.is_family_member(family_id)));

create policy "Owners and family members can add payments"
  on public.payments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.loans loan
      where loan.id = loan_id
        and ((select auth.uid()) = loan.user_id or (loan.family_id is not null and public.is_family_member(loan.family_id)))
    )
  );

-- Record the payment and update its loan inside one Postgres transaction. The
-- payment insert fires track_debt_payment_in_budget in the same transaction.
create or replace function public.record_loan_payment(
  target_loan_id uuid,
  payment_amount numeric,
  payment_kind public.payment_type,
  payment_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_loan public.loans%rowtype;
  new_balance numeric(12,2);
  new_payment_id uuid;
begin
  if payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select * into target_loan
  from public.loans
  where id = target_loan_id
  for update;

  if not found then raise exception 'Loan not found'; end if;

  new_balance := round(greatest(
    0,
    target_loan.current_balance
      + (target_loan.current_balance * target_loan.interest_rate / 12)
      - payment_amount
  ), 2);

  insert into public.payments (
    loan_id, user_id, amount, type, note, balance_after
  ) values (
    target_loan.id, (select auth.uid()), payment_amount, payment_kind,
    nullif(trim(payment_note), ''), new_balance
  ) returning id into new_payment_id;

  update public.loans
  set current_balance = new_balance,
      is_active = new_balance > 0,
      paid_off_at = case when new_balance = 0 then now() else null end
  where id = target_loan.id;

  return new_payment_id;
end;
$$;

grant execute on function public.record_loan_payment(uuid, numeric, public.payment_type, text) to authenticated;

-- Backfill prior payments so historical months and debt status are complete.
insert into public.budget_transactions (
  user_id, family_id, created_by, amount, occurred_on, merchant, note, source, payment_id
)
select
  loan.user_id,
  loan.family_id,
  payment.user_id,
  payment.amount,
  payment.paid_at::date,
  coalesce(loan.lender, loan.name),
  coalesce(payment.note, 'Debt payment'),
  'debt_payment',
  payment.id
from public.payments payment
join public.loans loan on loan.id = payment.loan_id
on conflict (payment_id) do nothing;

insert into public.budget_transaction_splits (transaction_id, category_id, amount)
select transaction.id, category.id, transaction.amount
from public.budget_transactions transaction
join public.payments payment on payment.id = transaction.payment_id
join public.budget_categories category on category.loan_id = payment.loan_id
where transaction.source = 'debt_payment'
on conflict (transaction_id, category_id) do nothing;

alter publication supabase_realtime add table public.budget_groups;
alter publication supabase_realtime add table public.budget_categories;
alter publication supabase_realtime add table public.monthly_budgets;
alter publication supabase_realtime add table public.monthly_budget_allocations;
alter publication supabase_realtime add table public.budget_transactions;
alter publication supabase_realtime add table public.budget_transaction_splits;
