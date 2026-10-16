-- ══════════════════════════════════════════════════════════════════════════
-- Arrow Word · Supabase step C · UNDO step B
-- Puts the puzzles, profiles, progress and comments rules back exactly as
-- they were before step B. (Step A stays; it only fixes the roles loop.)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists "Builders can publish puzzles" on public.puzzles;
drop policy if exists "Builders can update puzzles"  on public.puzzles;
drop policy if exists "Builders can delete puzzles"  on public.puzzles;
create policy "Anyone can publish puzzles" on public.puzzles for insert with check (true);
create policy "Anyone can update puzzles"  on public.puzzles for update using (true);
create policy "Anyone can delete puzzles"  on public.puzzles for delete using (true);

drop policy if exists "Admin can read all profiles" on public.user_profiles;
create policy "Admin can read all profiles" on public.user_profiles for select using (true);

drop policy if exists "Admin can read all progress" on public.user_progress;
create policy "Admin can read all progress" on public.user_progress for select using (true);

drop policy if exists "Signed-in users can send comments" on public.puzzle_comments;
create policy "Anyone can insert comments" on public.puzzle_comments for insert with check (true);

drop policy if exists "Users can read own comments" on public.puzzle_comments;
create policy "Users can read own comments" on public.puzzle_comments for select using ((auth.uid() = user_id) or true);
