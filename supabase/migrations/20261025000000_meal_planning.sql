-- A meal is a calendar entry, optionally linked to an existing recipe. Keep its
-- title if the recipe is deleted; deleting a recipe must not erase the plan.
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  meal_date date not null check (meal_date between date '1000-01-01' and date '9999-12-31'),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text not null check (length(trim(title)) between 1 and 160),
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plan_entries_scope_date_idx
  on public.meal_plan_entries(family_id, user_id, meal_date);
create index meal_plan_entries_recipe_idx on public.meal_plan_entries(recipe_id);
create trigger meal_plan_entries_updated_at before update on public.meal_plan_entries
  for each row execute function public.handle_updated_at();

create function public.validate_meal_plan_scope() returns trigger
language plpgsql set search_path = '' as $$
declare linked_recipe public.recipes;
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.family_id is distinct from old.family_id then
      raise exception 'A planned meal cannot be moved to another owner or family';
    end if;
  end if;
  if new.recipe_id is not null then
    select * into linked_recipe from public.recipes where id = new.recipe_id for share;
    if not found or linked_recipe.family_id is distinct from new.family_id
      or (new.family_id is null and linked_recipe.user_id <> new.user_id) then
      raise exception 'Choose a recipe in the same personal or family collection';
    end if;
  end if;
  return new;
end;
$$;
create trigger meal_plan_entries_scope before insert or update on public.meal_plan_entries
  for each row execute function public.validate_meal_plan_scope();

alter table public.meal_plan_entries enable row level security;
create policy "Read scoped meals" on public.meal_plan_entries for select to authenticated
  using (public.can_access_portal_scope(user_id, family_id));
create policy "Create scoped meals" on public.meal_plan_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_portal_scope(user_id, family_id));
create policy "Edit scoped meals" on public.meal_plan_entries for update to authenticated
  using (public.can_access_portal_scope(user_id, family_id))
  with check (public.can_access_portal_scope(user_id, family_id));
create policy "Delete scoped meals" on public.meal_plan_entries for delete to authenticated
  using (public.can_access_portal_scope(user_id, family_id));
grant select, insert, update, delete on public.meal_plan_entries to authenticated;
alter publication supabase_realtime add table public.meal_plan_entries;
