-- Allow admins to update member roles
create policy "Admins can update family member roles"
  on public.family_members for update
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));
