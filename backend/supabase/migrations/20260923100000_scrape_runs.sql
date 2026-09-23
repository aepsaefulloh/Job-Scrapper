create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  keyword text,
  location text,
  status text not null check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((finished_at is null) = (status in ('pending', 'running')))
);

create index scrape_runs_candidate_created_idx on public.scrape_runs (candidate_id, created_at desc);
create index scrape_runs_active_idx on public.scrape_runs (candidate_id, started_at desc) where status in ('pending', 'running');

grant select, insert, update on public.scrape_runs to authenticated;
alter table public.scrape_runs enable row level security;
create policy "Candidates can read their own scrape runs" on public.scrape_runs for select to authenticated using ((select auth.uid()) = candidate_id);
create policy "Candidates can create their own scrape runs" on public.scrape_runs for insert to authenticated with check ((select auth.uid()) = candidate_id);
create policy "Candidates can update their own scrape runs" on public.scrape_runs for update to authenticated using ((select auth.uid()) = candidate_id) with check ((select auth.uid()) = candidate_id);
