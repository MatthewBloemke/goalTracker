-- Debt categories carry forward the most recent planned payment, falling back
-- to the loan's minimum payment for the first plan. These inserts only fill
-- missing allocations, so a family's edited plan is never overwritten.

create or replace function public.seed_monthly_debt_allocations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monthly_budget_allocations (
    monthly_budget_id,
    category_id,
    planned_amount,
    rollover_amount
  )
  select
    new.id,
    category.id,
    coalesce((
      select previous_allocation.planned_amount
      from public.monthly_budget_allocations previous_allocation
      join public.monthly_budgets previous_budget
        on previous_budget.id = previous_allocation.monthly_budget_id
      where previous_allocation.category_id = category.id
        and previous_budget.month < new.month
        and previous_budget.family_id is not distinct from new.family_id
        and (new.family_id is not null or previous_budget.user_id = new.user_id)
      order by previous_budget.month desc
      limit 1
    ), loan.min_payment),
    0
  from public.budget_categories category
  join public.budget_groups budget_group on budget_group.id = category.group_id
  join public.loans loan on loan.id = category.loan_id
  where category.archived_at is null
    and loan.is_active = true
    and budget_group.family_id is not distinct from new.family_id
    and (new.family_id is not null or budget_group.user_id = new.user_id)
  on conflict (monthly_budget_id, category_id) do nothing;

  return new;
end;
$$;

create trigger seed_new_month_debt_allocations
  after insert on public.monthly_budgets
  for each row execute function public.seed_monthly_debt_allocations();

create or replace function public.seed_new_loan_debt_allocations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_category_id uuid;
begin
  if not new.is_active then return new; end if;

  select id into debt_category_id
  from public.budget_categories
  where loan_id = new.id;

  if debt_category_id is null then return new; end if;

  insert into public.monthly_budget_allocations (
    monthly_budget_id,
    category_id,
    planned_amount,
    rollover_amount
  )
  select
    monthly_budget.id,
    debt_category_id,
    coalesce((
      select previous_allocation.planned_amount
      from public.monthly_budget_allocations previous_allocation
      join public.monthly_budgets previous_budget
        on previous_budget.id = previous_allocation.monthly_budget_id
      where previous_allocation.category_id = debt_category_id
        and previous_budget.month < monthly_budget.month
        and previous_budget.family_id is not distinct from monthly_budget.family_id
        and (monthly_budget.family_id is not null or previous_budget.user_id = monthly_budget.user_id)
      order by previous_budget.month desc
      limit 1
    ), new.min_payment),
    0
  from public.monthly_budgets monthly_budget
  where monthly_budget.month >= date_trunc('month', current_date)::date
    and monthly_budget.family_id is not distinct from new.family_id
    and (new.family_id is not null or monthly_budget.user_id = new.user_id)
  on conflict (monthly_budget_id, category_id) do nothing;

  return new;
end;
$$;

-- Trigger names at the same timing/event run alphabetically. The zz prefix
-- ensures the Debt category sync trigger creates the category first.
create trigger zz_seed_new_loan_debt_allocations
  after insert or update of family_id, user_id, is_active, min_payment on public.loans
  for each row execute function public.seed_new_loan_debt_allocations();

-- Fill missing defaults for any current/future plans created before this
-- migration. Historical months remain untouched.
insert into public.monthly_budget_allocations (
  monthly_budget_id,
  category_id,
  planned_amount,
  rollover_amount
)
select
  monthly_budget.id,
  category.id,
  coalesce((
    select previous_allocation.planned_amount
    from public.monthly_budget_allocations previous_allocation
    join public.monthly_budgets previous_budget
      on previous_budget.id = previous_allocation.monthly_budget_id
    where previous_allocation.category_id = category.id
      and previous_budget.month < monthly_budget.month
      and previous_budget.family_id is not distinct from monthly_budget.family_id
      and (monthly_budget.family_id is not null or previous_budget.user_id = monthly_budget.user_id)
    order by previous_budget.month desc
    limit 1
  ), loan.min_payment),
  0
from public.monthly_budgets monthly_budget
join public.budget_groups budget_group
  on budget_group.family_id is not distinct from monthly_budget.family_id
  and (monthly_budget.family_id is not null or budget_group.user_id = monthly_budget.user_id)
join public.budget_categories category on category.group_id = budget_group.id
join public.loans loan on loan.id = category.loan_id
where monthly_budget.month >= date_trunc('month', current_date)::date
  and category.archived_at is null
  and loan.is_active = true
on conflict (monthly_budget_id, category_id) do nothing;

-- Copying creates the destination month first, which now seeds Debt defaults.
-- Upsert copied allocations afterward so prior edits and rollover win.
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
  where allocation.monthly_budget_id = source_budget.id
  on conflict (monthly_budget_id, category_id) do update
    set planned_amount = excluded.planned_amount,
        rollover_amount = excluded.rollover_amount;

  return new_budget_id;
end;
$$;
