-- Migration: search_executions
-- Introduces parent search_executions table to group multi-source scrape runs under one user-initiated search action.
-- Strictly candidate-owned via RLS policies.

create table if not exists public.search_executions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  preferences_snapshot jsonb not null default '{}'::jsonb,
  intents_snapshot jsonb not null default '[]'::jsonb,
  stages jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{
    "discovered": 0,
    "inserted": 0,
    "updated": 0,
    "duplicates": 0,
    "failed": 0,
    "filteredOut": 0,
    "aiEvaluated": 0,
    "aiFailed": 0
  }'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

-- Link child scrape_runs to search_executions
alter table public.scrape_runs 
  add column if not exists search_execution_id uuid references public.search_executions (id) on delete cascade;

create index if not exists search_executions_candidate_created_idx 
  on public.search_executions (candidate_id, created_at desc);

create index if not exists scrape_runs_search_execution_id_idx 
  on public.scrape_runs (search_execution_id);

grant select, insert, update, delete on public.search_executions to authenticated;
alter table public.search_executions enable row level security;

create policy "Candidates can read their own search executions"
  on public.search_executions for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own search executions"
  on public.search_executions for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own search executions"
  on public.search_executions for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own search executions"
  on public.search_executions for delete to authenticated
  using ((select auth.uid()) = candidate_id);
