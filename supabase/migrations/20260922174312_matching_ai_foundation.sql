create extension if not exists vector with schema extensions;

alter table public.profiles
  add column embedding extensions.vector(1536),
  add column embedding_model text,
  add column embedding_dimensions integer check (embedding_dimensions is null or embedding_dimensions > 0),
  add column embedding_content_checksum char(64),
  add column embedding_status text not null default 'pending' check (embedding_status in ('pending', 'ready', 'failed')),
  add column embedding_error text,
  add column embedding_updated_at timestamptz;

alter table public.jobs
  add column embedding extensions.vector(1536),
  add column embedding_model text,
  add column embedding_dimensions integer check (embedding_dimensions is null or embedding_dimensions > 0),
  add column embedding_content_checksum char(64),
  add column embedding_status text not null default 'pending' check (embedding_status in ('pending', 'ready', 'failed')),
  add column embedding_error text,
  add column embedding_updated_at timestamptz;

create index profiles_embedding_hnsw_idx on public.profiles using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null and embedding_status = 'ready';
create index jobs_embedding_hnsw_idx on public.jobs using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null and embedding_status = 'ready';

create or replace function public.match_candidate_jobs(
  p_candidate_id uuid,
  p_query_embedding extensions.vector(1536),
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
    and jobs.candidate_id = p_candidate_id
    and jobs.deleted_at is null
    and jobs.status = 'active'
    and jobs.embedding_status = 'ready'
    and jobs.embedding is not null
    and (1 - (jobs.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_match_threshold
  order by jobs.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 200);
$$;

revoke execute on function public.match_candidate_jobs(uuid, extensions.vector(1536), double precision, integer) from public;
grant execute on function public.match_candidate_jobs(uuid, extensions.vector(1536), double precision, integer) to authenticated;
