-- Structured, personal/family-scoped recipes. Sharing creates independent copies;
-- no public read policies or cross-family grants are needed.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  servings numeric check (servings > 0 and servings <= 100000),
  source_url text not null default '' check (length(source_url) <= 2048 and (source_url = '' or source_url ~ '^https?://')),
  notes text not null default '' check (length(notes) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position between 0 and 99),
  name text not null check (length(trim(name)) between 1 and 160),
  quantity numeric check (quantity > 0 and quantity <= 100000),
  unit text not null default '' check (length(unit) <= 40),
  preparation text not null default '' check (length(preparation) <= 300),
  shopping_quantity numeric not null default 1 check (shopping_quantity > 0 and shopping_quantity <= 100000),
  shopping_unit text not null default 'container' check (length(trim(shopping_unit)) between 1 and 40),
  unique(recipe_id, position)
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position between 0 and 99),
  instruction text not null check (length(trim(instruction)) between 1 and 2000),
  unique(recipe_id, position)
);

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.handle_updated_at();

create function public.keep_recipe_scope_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id or new.family_id is distinct from old.family_id then
    raise exception 'A recipe cannot be moved to another owner or family';
  end if;
  return new;
end;
$$;
create trigger recipes_keep_scope before update on public.recipes
  for each row execute function public.keep_recipe_scope_immutable();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

create policy "Read scoped recipes" on public.recipes for select to authenticated
  using (public.can_access_portal_scope(user_id, family_id));
create policy "Create scoped recipes" on public.recipes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_portal_scope(user_id, family_id));
create policy "Edit scoped recipes" on public.recipes for update to authenticated
  using (public.can_access_portal_scope(user_id, family_id))
  with check (public.can_access_portal_scope(user_id, family_id));
create policy "Delete scoped recipes" on public.recipes for delete to authenticated
  using (public.can_access_portal_scope(user_id, family_id));

create policy "Scoped ingredients" on public.recipe_ingredients for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id));
create policy "Scoped instructions" on public.recipe_steps for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id));
grant select, insert, update, delete on public.recipes, public.recipe_ingredients, public.recipe_steps to authenticated;
create index recipes_scope_idx on public.recipes(family_id, user_id, title);

-- One transaction prevents partially saved ingredients/steps. A revision check
-- prevents a stale editor from overwriting a family member's newer edits.
create function public.save_recipe(
  recipe_data jsonb, target_id uuid default null, target_family_id uuid default null,
  expected_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  saved_id uuid;
  current_recipe public.recipes;
  tag text;
  ingredient jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save recipes'; end if;
  if jsonb_typeof(recipe_data) is distinct from 'object' or octet_length(recipe_data::text) > 100000 then
    raise exception 'Recipe data is invalid or too large';
  end if;
  if jsonb_typeof(recipe_data->'title') is distinct from 'string'
    or jsonb_typeof(recipe_data->'sourceUrl') is distinct from 'string'
    or jsonb_typeof(recipe_data->'notes') is distinct from 'string'
    or coalesce(jsonb_typeof(recipe_data->'servings'), '') not in ('number', 'null') then
    raise exception 'Invalid recipe field types';
  end if;
  if jsonb_typeof(recipe_data->'ingredients') is distinct from 'array'
    or jsonb_typeof(recipe_data->'instructions') is distinct from 'array'
    or jsonb_typeof(recipe_data->'tags') is distinct from 'array' then
    raise exception 'Ingredients, instructions and tags must be arrays';
  end if;
  if jsonb_array_length(recipe_data->'ingredients') not between 1 and 100
    or jsonb_array_length(recipe_data->'instructions') not between 1 and 100
    or jsonb_array_length(recipe_data->'tags') > 20 then
    raise exception 'Recipe has an invalid number of ingredients, steps or tags';
  end if;
  for tag in select jsonb_array_elements_text(recipe_data->'tags') loop
    if tag is null or length(trim(tag)) not between 1 and 40 then raise exception 'Invalid tag'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(recipe_data->'tags') t where jsonb_typeof(t) <> 'string') then
    raise exception 'Tags must be text';
  end if;
  for ingredient in select jsonb_array_elements(recipe_data->'ingredients') loop
    if jsonb_typeof(ingredient) is distinct from 'object'
      or jsonb_typeof(ingredient->'name') is distinct from 'string'
      or jsonb_typeof(ingredient->'unit') is distinct from 'string'
      or jsonb_typeof(ingredient->'preparation') is distinct from 'string'
      or jsonb_typeof(ingredient->'shoppingUnit') is distinct from 'string'
      or jsonb_typeof(ingredient->'shoppingQuantity') is distinct from 'number'
      or coalesce(jsonb_typeof(ingredient->'quantity'), '') not in ('number', 'null') then
      raise exception 'Invalid ingredient field types';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(recipe_data->'instructions') s where jsonb_typeof(s) <> 'string') then
    raise exception 'Instructions must be text';
  end if;

  if target_id is null then
    insert into public.recipes(user_id, family_id, title, servings, source_url, notes, tags)
    values(auth.uid(), target_family_id, trim(recipe_data->>'title'), (recipe_data->>'servings')::numeric,
      coalesce(recipe_data->>'sourceUrl', ''), coalesce(recipe_data->>'notes', ''),
      array(select distinct lower(trim(value)) from jsonb_array_elements_text(recipe_data->'tags')))
    returning id into saved_id;
  else
    select * into current_recipe from public.recipes where id = target_id for update;
    if not found or current_recipe.family_id is distinct from target_family_id then raise exception 'Recipe not found in this collection'; end if;
    if expected_updated_at is null or current_recipe.updated_at <> expected_updated_at then
      raise exception 'This recipe changed since you opened it. Close the editor and reopen the latest version.';
    end if;
    saved_id := target_id;
    update public.recipes set title = trim(recipe_data->>'title'), servings = (recipe_data->>'servings')::numeric,
      source_url = coalesce(recipe_data->>'sourceUrl', ''), notes = coalesce(recipe_data->>'notes', ''),
      tags = array(select distinct lower(trim(value)) from jsonb_array_elements_text(recipe_data->'tags'))
    where id = saved_id;
    delete from public.recipe_ingredients where recipe_id = saved_id;
    delete from public.recipe_steps where recipe_id = saved_id;
  end if;

  insert into public.recipe_ingredients(recipe_id, position, name, quantity, unit, preparation, shopping_quantity, shopping_unit)
  select saved_id, (ordinality - 1)::integer, trim(value->>'name'), (value->>'quantity')::numeric,
    coalesce(value->>'unit', ''), coalesce(value->>'preparation', ''),
    (value->>'shoppingQuantity')::numeric, trim(value->>'shoppingUnit')
  from jsonb_array_elements(recipe_data->'ingredients') with ordinality;
  insert into public.recipe_steps(recipe_id, position, instruction)
  select saved_id, (ordinality - 1)::integer, trim(value)
  from jsonb_array_elements_text(recipe_data->'instructions') with ordinality;
  return saved_id;
end;
$$;
revoke all on function public.save_recipe(jsonb, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.save_recipe(jsonb, uuid, uuid, timestamptz) to authenticated;

-- Copy shopping quantities into ordinary task items. The recipe and destination
-- must belong to the SAME personal/family scope, even when both are accessible.
create function public.add_recipe_to_task_list(
  source_recipe_id uuid, ingredient_ids uuid[], target_list_id uuid default null,
  new_list_name text default 'Shopping list'
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  source_recipe public.recipes;
  destination public.task_lists;
  next_position integer;
begin
  select * into source_recipe from public.recipes where id = source_recipe_id for share;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if ingredient_ids is null or cardinality(ingredient_ids) not between 1 and 100
    or (select count(*) from public.recipe_ingredients where recipe_id = source_recipe_id and id = any(ingredient_ids)) <> cardinality(ingredient_ids) then
    raise exception 'Choose valid ingredients from this recipe. It may have been edited; reopen it and try again.';
  end if;
  if target_list_id is null then
    if new_list_name is null or length(trim(new_list_name)) not between 1 and 160 then raise exception 'Enter a shopping list name'; end if;
    insert into public.task_lists(user_id, family_id, name)
    values(auth.uid(), source_recipe.family_id, trim(new_list_name)) returning * into destination;
  else
    select * into destination from public.task_lists where id = target_list_id for update;
    if not found then raise exception 'Task list not found or access denied'; end if;
  end if;
  if destination.family_id is distinct from source_recipe.family_id
    or (destination.family_id is null and destination.user_id <> source_recipe.user_id) then
    raise exception 'Choose a task list in the same personal or family collection';
  end if;
  select coalesce(max(sort_order), -1) + 1 into next_position from public.task_items where list_id = destination.id;
  insert into public.task_items(list_id, created_by, name, notes, sort_order)
  select destination.id, auth.uid(), concat(shopping_quantity, ' ', shopping_unit, ' ', name),
    concat('For: ', source_recipe.title, E'\nRecipe amount: ', quantity, ' ', unit, ' ', name,
      case when preparation <> '' then ' (' || preparation || ')' else '' end),
    next_position + (row_number() over (order by position) - 1)::integer
  from public.recipe_ingredients where recipe_id = source_recipe_id and id = any(ingredient_ids);
  return destination.id;
end;
$$;
revoke all on function public.add_recipe_to_task_list(uuid, uuid[], uuid, text) from public, anon;
grant execute on function public.add_recipe_to_task_list(uuid, uuid[], uuid, text) to authenticated;

alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_ingredients;
alter publication supabase_realtime add table public.recipe_steps;

-- Independently approved and rate-limited: receipt access does NOT grant recipe AI.
create table public.recipe_import_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index recipe_import_requests_user_time_idx on public.recipe_import_requests(user_id, created_at desc);
alter table public.recipe_import_requests enable row level security;
revoke all on public.recipe_import_requests from anon, authenticated;

create function public.consume_recipe_import_quota() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  feature_grant public.feature_access_grants;
  hour_count integer;
  day_count integer;
  request_id uuid;
begin
  if caller is null then return jsonb_build_object('allowed', false, 'reason', 'unauthenticated'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text || ':recipe_import', 0));
  select * into feature_grant from public.feature_access_grants
    where user_id = caller and feature = 'recipe_import' and revoked_at is null for share;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'not_approved'); end if;
  select count(*) filter(where created_at >= now() - interval '1 hour'), count(*)
    into hour_count, day_count from public.recipe_import_requests
    where user_id = caller and created_at >= now() - interval '24 hours';
  if day_count >= feature_grant.daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;
  if hour_count >= feature_grant.hourly_limit then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_limit');
  end if;
  insert into public.recipe_import_requests(user_id) values(caller) returning id into request_id;
  return jsonb_build_object('allowed', true, 'requestId', request_id);
end;
$$;
revoke all on function public.consume_recipe_import_quota() from public, anon;
grant execute on function public.consume_recipe_import_quota() to authenticated;
