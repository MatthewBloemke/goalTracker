-- Let families copy the prior month's plan without carrying forward balances
-- when the source month's transaction history is incomplete.
drop function if exists public.copy_budget_month(uuid, date);

create function public.copy_budget_month(
  source_budget_id uuid,
  target_month date,
  carry_surplus boolean default true
)
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

  select * into source_budget
  from public.monthly_budgets
  where id = source_budget_id;

  if not found then
    raise exception 'Source budget not found';
  end if;

  insert into public.monthly_budgets (
    user_id,
    family_id,
    month,
    income,
    created_by
  )
  values (
    source_budget.user_id,
    source_budget.family_id,
    target_month,
    source_budget.income,
    (select auth.uid())
  )
  returning id into new_budget_id;

  insert into public.monthly_budget_allocations (
    monthly_budget_id,
    category_id,
    planned_amount,
    rollover_amount
  )
  select
    new_budget_id,
    allocation.category_id,
    allocation.planned_amount,
    case
      when carry_surplus then greatest(
        allocation.planned_amount
          + allocation.rollover_amount
          - coalesce(spending.amount, 0),
        0
      )
      else 0
    end
  from public.monthly_budget_allocations allocation
  left join lateral (
    select sum(split.amount) as amount
    from public.budget_transaction_splits split
    join public.budget_transactions transaction
      on transaction.id = split.transaction_id
    where split.category_id = allocation.category_id
      and transaction.occurred_on >= source_budget.month
      and transaction.occurred_on
        < (source_budget.month + interval '1 month')::date
  ) spending on true
  where allocation.monthly_budget_id = source_budget.id
  on conflict (monthly_budget_id, category_id) do update
    set planned_amount = excluded.planned_amount,
        rollover_amount = excluded.rollover_amount;

  return new_budget_id;
end;
$$;

revoke all on function public.copy_budget_month(uuid, date, boolean)
  from public, anon;
grant execute on function public.copy_budget_month(uuid, date, boolean)
  to authenticated;

