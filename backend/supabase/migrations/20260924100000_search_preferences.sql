-- Migration: candidate_job_search_preferences
-- Configurable operational search preferences (sources, locations, work modes, employment types, freshness)
-- decoupled from candidate CV Markdown.
-- One preferences record per candidate (unique constraint). Candidate-owned via RLS.

create table if not exists public.candidate_job_search_preferences (
  id                          uuid primary key default gen_random_uuid(),
  candidate_id                uuid not null references public.candidates (id) on delete cascade,
  sources                     jsonb not null default '["jobstreet", "loker-id"]'::jsonb,
  locations                   jsonb not null default '[]'::jsonb,
  work_modes                  jsonb not null default '[]'::jsonb,
  employment_types            jsonb not null default '[]'::jsonb,
  max_posting_age_days        int not null default 7 check (max_posting_age_days between 1 and 90),
  unknown_posting_date_policy text not null default 'exclude' check (unknown_posting_date_policy in ('exclude', 'allow')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (candidate_id)
);

create index if not exists candidate_job_search_preferences_candidate_idx
  on public.candidate_job_search_preferences (candidate_id);

grant select, insert, update, delete on public.candidate_job_search_preferences to authenticated;
alter table public.candidate_job_search_preferences enable row level security;

create policy "Candidates can read their own search preferences"
  on public.candidate_job_search_preferences for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can insert their own search preferences"
  on public.candidate_job_search_preferences for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own search preferences"
  on public.candidate_job_search_preferences for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own search preferences"
  on public.candidate_job_search_preferences for delete to authenticated
  using ((select auth.uid()) = candidate_id);
