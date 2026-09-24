create table public.ai_match_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_checksum char(64) not null,
  job_checksum char(64) not null,
  prompt_version text not null,
  model text not null,
  evaluation jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_match_evaluations_cache_identity_key
    unique (candidate_id, profile_checksum, job_checksum, prompt_version, model)
);

create index ai_match_evaluations_candidate_job_updated_idx
  on public.ai_match_evaluations (candidate_id, job_id, updated_at desc);

alter table public.ai_match_evaluations enable row level security;

revoke all on table public.ai_match_evaluations from anon;
revoke all on table public.ai_match_evaluations from authenticated;
grant select, insert, update, delete on table public.ai_match_evaluations to authenticated;

create policy ai_match_evaluations_select_own
  on public.ai_match_evaluations
  for select
  to authenticated
  using ((select auth.uid()) = candidate_id);

create policy ai_match_evaluations_insert_own
  on public.ai_match_evaluations
  for insert
  to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy ai_match_evaluations_update_own
  on public.ai_match_evaluations
  for update
  to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy ai_match_evaluations_delete_own
  on public.ai_match_evaluations
  for delete
  to authenticated
  using ((select auth.uid()) = candidate_id);

create or replace function public.match_candidate_job_subset(
  p_candidate_id uuid,
  p_query_embedding extensions.vector(1536),
  p_job_ids uuid[],
  p_match_threshold double precision default 0,
  p_match_count integer default 20
)
returns table (job_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    jobs.id,
    (1 - (jobs.embedding OPERATOR(extensions.<=>) p_query_embedding))::double precision
  from public.jobs
  where auth.uid() = p_candidate_id
    and coalesce(cardinality(p_job_ids), 0) > 0
    and jobs.id = any(p_job_ids)
    and jobs.candidate_id = p_candidate_id
    and jobs.deleted_at is null
    and jobs.status = 'active'
    and jobs.embedding_status = 'ready'
    and jobs.embedding is not null
    and (1 - (jobs.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_match_threshold
  order by jobs.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 200);
$$;

revoke execute on function public.match_candidate_job_subset(uuid, extensions.vector(1536), uuid[], double precision, integer) from public;
grant execute on function public.match_candidate_job_subset(uuid, extensions.vector(1536), uuid[], double precision, integer) to authenticated;
