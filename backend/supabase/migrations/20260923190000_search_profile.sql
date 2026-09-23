-- Migration: candidate_search_profiles
-- Stores the derived CandidateSearchProfile JSON for each candidate.
-- One profile per candidate (unique constraint). Candidate-owned via RLS.

create table if not exists public.candidate_search_profiles (
  id                        uuid primary key default gen_random_uuid(),
  candidate_id              uuid not null references public.candidates (id) on delete cascade,
  source_profile_id         uuid references public.profiles (id) on delete set null,
  source_profile_updated_at timestamptz,
  profile_data              jsonb not null,
  generated_at              timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (candidate_id)
);

create index if not exists candidate_search_profiles_candidate_idx
  on public.candidate_search_profiles (candidate_id);

grant select, insert, update, delete on public.candidate_search_profiles to authenticated;
alter table public.candidate_search_profiles enable row level security;

create policy "Candidates can read their own search profile"
  on public.candidate_search_profiles for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can insert their own search profile"
  on public.candidate_search_profiles for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own search profile"
  on public.candidate_search_profiles for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own search profile"
  on public.candidate_search_profiles for delete to authenticated
  using ((select auth.uid()) = candidate_id);
