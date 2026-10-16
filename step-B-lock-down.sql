-- ══════════════════════════════════════════════════════════════════════════
-- Arrow Word · Supabase step B · lock down puzzles and private data
-- Run ONLY after step A, and after the builders and the admin have checked
-- that the builder shows "Role: builder" / "Role: admin" in the green bar.
-- To undo, run step-C-undo.sql.
--
-- What it does:
--  1. Puzzles: everyone can still read them, but only builders and admins can
--     add, change or delete them.
--  2. Profiles (names, emails) and progress: each person can read only their
--     own; the admin can read everyone's (for the admin page).
--  3. Comments: must be signed in to send one; each person can read their
--     own; the admin can read all.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Puzzles
drop policy if exists "Anyone can publish puzzles" on public.puzzles;
drop policy if exists "Anyone can update puzzles"  on public.puzzles;
drop policy if exists "Anyone can delete puzzles"  on public.puzzles;

create policy "Builders can publish puzzles" on public.puzzles
  for insert
  with check (public.my_role() in ('builder', 'admin'));

create policy "Builders can update puzzles" on public.puzzles
  for update
  using (public.my_role() in ('builder', 'admin'))
  with check (public.my_role() in ('builder', 'admin'));

create policy "Builders can delete puzzles" on public.puzzles
  for delete
  using (public.my_role() in ('builder', 'admin'));

-- 2. Profiles and progress
drop policy if exists "Admin can read all profiles" on public.user_profiles;
create policy "Admin can read all profiles" on public.user_profiles
  for select
  using (public.my_role() = 'admin');

drop policy if exists "Admin can read all progress" on public.user_progress;
create policy "Admin can read all progress" on public.user_progress
  for select
  using (public.my_role() = 'admin');

-- 3. Comments
drop policy if exists "Anyone can insert comments" on public.puzzle_comments;
create policy "Signed-in users can send comments" on public.puzzle_comments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own comments" on public.puzzle_comments;
create policy "Users can read own comments" on public.puzzle_comments
  for select
  using (auth.uid() = user_id or public.my_role() = 'admin');
