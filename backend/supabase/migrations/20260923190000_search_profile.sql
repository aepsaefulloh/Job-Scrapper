-- Migration: candidate_search_profiles
-- Stores the derived CandidateSearchProfile JSON for each candidate.
-- One profile per candidate (unique constraint). Candidate-owned via RLS.

create table if not exists candidate_search_profiles (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  profile_data  jsonb not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(candidate_id)
);

alter table candidate_search_profiles enable row level security;

create policy "Candidates own their search profile"
  on candidate_search_profiles
  for all
  using (candidate_id = auth.uid())
  with check (candidate_id = auth.uid());

create index if not exists idx_search_profiles_candidate
  on candidate_search_profiles(candidate_id);
