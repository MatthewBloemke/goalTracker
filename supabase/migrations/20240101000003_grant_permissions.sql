-- Grant usage on the public schema to authenticated and anon roles
grant usage on schema public to anon, authenticated;

-- Grant table permissions to authenticated users
grant all on public.profiles        to authenticated;
grant all on public.families        to authenticated;
grant all on public.family_members  to authenticated;
grant all on public.family_settings to authenticated;
grant all on public.loans           to authenticated;
grant all on public.payments        to authenticated;

-- Grant sequence permissions (needed for inserts)
grant usage, select on all sequences in schema public to authenticated;

-- Anon only needs to read (for invite code lookups before auth, etc.)
grant select on public.families to anon;
