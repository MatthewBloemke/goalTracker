-- Prevent deleting the last admin from a family at the DB level
create or replace function public.check_last_admin()
returns trigger
language plpgsql
as $$
begin
  -- Only care about admin removals
  if OLD.role = 'admin' then
    if (
      select count(*) from public.family_members
      where family_id = OLD.family_id and role = 'admin' and id != OLD.id
    ) = 0 then
      raise exception 'Cannot remove the last admin from a family';
    end if;
  end if;
  return OLD;
end;
$$;

create trigger enforce_last_admin
  before delete on public.family_members
  for each row execute function public.check_last_admin();
