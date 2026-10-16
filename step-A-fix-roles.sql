-- ══════════════════════════════════════════════════════════════════════════
-- Arrow Word · Supabase step A · fix the user roles loop
-- Safe to run now. Run it once in Supabase > SQL Editor.
--
-- Why: the rule "Admin can manage roles" looked inside the user_roles table
-- to decide if you are an admin. Postgres then gets stuck in a loop and refuses
-- every role lookup, so builders looked like ordinary users. This is what
-- went wrong the last time builder sign-in was tried.
--
-- What it does:
--  1. Adds a small helper, my_role(), that reads the signed-in person's role
--     directly, so rules can check it without the loop.
--  2. Rewrites the two user_roles rules to use it.
-- Nothing else changes. Nobody's access to puzzles or progress changes.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1
$$;

grant execute on function public.my_role() to anon, authenticated;

drop policy if exists "Admin can manage roles" on public.user_roles;
create policy "Admin can manage roles" on public.user_roles
  for all
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role" on public.user_roles
  for select
  using (auth.uid() = user_id);
