-- ============================================================
-- TASK PLANNER
-- Personal or family-scoped project lists with manually ordered tasks.
-- ============================================================

create or replace function public.can_access_portal_scope(
  owner_id uuid,
  fam_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (fam_id is null and owner_id = (select auth.uid()))
    or (fam_id is not null and public.is_family_member(fam_id))
$$;

grant execute on function public.can_access_portal_scope(uuid, uuid)
  to authenticated;

create table public.task_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  family_id  uuid references public.families(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.task_lists(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete restrict,
  name         text not null check (length(trim(name)) > 0),
  notes        text,
  sort_order   integer not null default 0 check (sort_order >= 0),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger task_lists_updated_at
  before update on public.task_lists
  for each row execute function public.handle_updated_at();

create trigger task_items_updated_at
  before update on public.task_items
  for each row execute function public.handle_updated_at();

create or replace function public.keep_task_scope_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'task_lists' then
    if new.user_id <> old.user_id
      or new.family_id is distinct from old.family_id then
      raise exception 'A task list cannot be moved to another owner or family';
    end if;
  elsif new.list_id <> old.list_id or new.created_by <> old.created_by then
    raise exception 'A task cannot be moved to another list or creator';
  end if;
  return new;
end;
$$;

create trigger task_lists_keep_scope
  before update on public.task_lists
  for each row execute function public.keep_task_scope_immutable();

create trigger task_items_keep_scope
  before update on public.task_items
  for each row execute function public.keep_task_scope_immutable();

alter table public.task_lists enable row level security;
alter table public.task_items enable row level security;

create policy "Members can view task lists"
  on public.task_lists for select to authenticated
  using (public.can_access_portal_scope(user_id, family_id));

create policy "Members can create task lists"
  on public.task_lists for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.can_access_portal_scope(user_id, family_id)
  );

create policy "Members can update task lists"
  on public.task_lists for update to authenticated
  using (public.can_access_portal_scope(user_id, family_id))
  with check (public.can_access_portal_scope(user_id, family_id));

create policy "Members can delete task lists"
  on public.task_lists for delete to authenticated
  using (public.can_access_portal_scope(user_id, family_id));

create policy "Members can view task items"
  on public.task_items for select to authenticated
  using (
    exists (
      select 1
      from public.task_lists list
      where list.id = task_items.list_id
        and public.can_access_portal_scope(list.user_id, list.family_id)
    )
  );

create policy "Members can create task items"
  on public.task_items for insert to authenticated
  with check (
    (select auth.uid()) = created_by
    and exists (
      select 1
      from public.task_lists list
      where list.id = task_items.list_id
        and public.can_access_portal_scope(list.user_id, list.family_id)
    )
  );

create policy "Members can update task items"
  on public.task_items for update to authenticated
  using (
    exists (
      select 1
      from public.task_lists list
      where list.id = task_items.list_id
        and public.can_access_portal_scope(list.user_id, list.family_id)
    )
  )
  with check (
    exists (
      select 1
      from public.task_lists list
      where list.id = task_items.list_id
        and public.can_access_portal_scope(list.user_id, list.family_id)
    )
  );

create policy "Members can delete task items"
  on public.task_items for delete to authenticated
  using (
    exists (
      select 1
      from public.task_lists list
      where list.id = task_items.list_id
        and public.can_access_portal_scope(list.user_id, list.family_id)
    )
  );

grant all on public.task_lists to authenticated;
grant all on public.task_items to authenticated;

create index task_lists_scope_idx
  on public.task_lists(family_id, user_id, updated_at desc);
create index task_items_list_order_idx
  on public.task_items(list_id, sort_order, created_at);

create or replace function public.reorder_task_items(
  target_list_id uuid,
  ordered_item_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_count integer;
  supplied_count integer;
  unique_count integer;
begin
  if ordered_item_ids is null then
    raise exception 'Reorder request must include task IDs';
  end if;

  if not exists (
    select 1
    from public.task_lists list
    where list.id = target_list_id
      and public.can_access_portal_scope(list.user_id, list.family_id)
  ) then
    raise exception 'Task list not found or access denied';
  end if;

  select count(*) into expected_count
  from public.task_items
  where list_id = target_list_id;

  supplied_count := cardinality(ordered_item_ids);
  select count(distinct supplied.item_id) into unique_count
  from unnest(ordered_item_ids) as supplied(item_id);

  if supplied_count <> expected_count or unique_count <> expected_count then
    raise exception 'Reorder request must contain every task exactly once';
  end if;

  if exists (
    select 1
    from unnest(ordered_item_ids) as supplied(item_id)
    left join public.task_items item
      on item.id = supplied.item_id and item.list_id = target_list_id
    where item.id is null
  ) then
    raise exception 'Reorder request contains a task from another list';
  end if;

  update public.task_items item
  set sort_order = (ordered.ordinality - 1)::integer
  from unnest(ordered_item_ids) with ordinality as ordered(item_id, ordinality)
  where item.id = ordered.item_id
    and item.list_id = target_list_id;
end;
$$;

revoke all on function public.reorder_task_items(uuid, uuid[]) from public;
grant execute on function public.reorder_task_items(uuid, uuid[])
  to authenticated;

alter publication supabase_realtime add table public.task_lists;
alter publication supabase_realtime add table public.task_items;
