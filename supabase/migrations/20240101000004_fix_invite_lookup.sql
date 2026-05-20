-- Allow any authenticated user to look up a family by invite code
-- needed so users can join before they're a member
create policy "Authenticated users can look up family by invite code"
  on public.families for select
  to authenticated
  using (true);
