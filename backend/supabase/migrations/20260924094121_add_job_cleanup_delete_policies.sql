grant delete on public.jobs to authenticated;
grant delete on public.jobs_raw to authenticated;
grant delete on public.scrape_runs to authenticated;

create policy "Candidates can delete their own jobs"
  on public.jobs for delete to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own raw jobs"
  on public.jobs_raw for delete to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own scrape runs"
  on public.scrape_runs for delete to authenticated
  using ((select auth.uid()) = candidate_id);
