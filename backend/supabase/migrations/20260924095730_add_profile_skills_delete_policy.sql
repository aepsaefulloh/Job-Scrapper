grant delete on public.profile_skills to authenticated;

create policy "Candidates can delete skills for their own profiles"
  on public.profile_skills for delete to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.candidate_id = (select auth.uid())
    )
  );
