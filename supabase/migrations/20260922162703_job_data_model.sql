create table public.jobs_raw (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  external_id text,
  canonical_url text not null,
  payload jsonb not null,
  payload_checksum char(64) not null check (payload_checksum ~ '^[a-f0-9]{64}$'),
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (candidate_id, source, canonical_url, payload_checksum)
);

create index jobs_raw_candidate_id_idx on public.jobs_raw (candidate_id);
create index jobs_raw_lookup_idx on public.jobs_raw (candidate_id, source, external_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  external_id text,
  canonical_url text not null,
  title text not null,
  company_name text not null,
  description text not null,
  location text,
  employment_type text,
  workplace_type text,
  published_at timestamptz,
  expires_at timestamptz,
  source_payload_id uuid not null references public.jobs_raw (id) on delete restrict,
  content_checksum char(64) not null check (content_checksum ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active', 'expired', 'closed')), 
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index jobs_candidate_id_idx on public.jobs (candidate_id);
create index jobs_candidate_status_idx on public.jobs (candidate_id, status) where deleted_at is null;
create unique index jobs_external_identity_idx on public.jobs (candidate_id, source, external_id)
  where external_id is not null and deleted_at is null;
create unique index jobs_url_identity_idx on public.jobs (candidate_id, source, canonical_url)
  where external_id is null and deleted_at is null;

create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  display_name text not null,
  canonical_name text not null,
  match_method text not null default 'keyword' check (match_method = 'keyword'),
  created_at timestamptz not null default now(),
  unique (job_id, canonical_name)
);

create index job_skills_candidate_id_idx on public.job_skills (candidate_id);
create index job_skills_job_id_idx on public.job_skills (job_id);

grant select, insert, update on public.jobs_raw to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert, update, delete on public.job_skills to authenticated;

alter table public.jobs_raw enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;

create policy "Candidates can read their own raw jobs"
  on public.jobs_raw for select to authenticated
  using ((select auth.uid()) = candidate_id);
create policy "Candidates can create their own raw jobs"
  on public.jobs_raw for insert to authenticated
  with check ((select auth.uid()) = candidate_id);
create policy "Candidates can update their own raw jobs"
  on public.jobs_raw for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can read their own jobs"
  on public.jobs for select to authenticated
  using ((select auth.uid()) = candidate_id);
create policy "Candidates can create their own jobs"
  on public.jobs for insert to authenticated
  with check ((select auth.uid()) = candidate_id);
create policy "Candidates can update their own jobs"
  on public.jobs for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can read their own job skills"
  on public.job_skills for select to authenticated
  using ((select auth.uid()) = candidate_id);
create policy "Candidates can create their own job skills"
  on public.job_skills for insert to authenticated
  with check ((select auth.uid()) = candidate_id);
create policy "Candidates can update their own job skills"
  on public.job_skills for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);
create policy "Candidates can delete their own job skills"
  on public.job_skills for delete to authenticated
  using ((select auth.uid()) = candidate_id);

create or replace function public.upsert_job_ingestion(
  p_candidate_id uuid,
  p_source text,
  p_external_id text,
  p_canonical_url text,
  p_payload jsonb,
  p_payload_checksum text,
  p_fetched_at timestamptz,
  p_title text,
  p_company_name text,
  p_description text,
  p_location text,
  p_employment_type text,
  p_workplace_type text,
  p_published_at timestamptz,
  p_expires_at timestamptz,
  p_content_checksum text,
  p_skills jsonb
)
returns table (raw_id uuid, job_id uuid, changed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_raw_id uuid;
  v_job_id uuid;
  v_old_checksum text;
  v_changed boolean;
begin
  if auth.uid() is null or auth.uid() <> p_candidate_id then
    raise exception 'Candidate authentication mismatch.' using errcode = '42501';
  end if;

  insert into public.candidates (id) values (p_candidate_id) on conflict (id) do nothing;

  insert into public.jobs_raw (candidate_id, source, external_id, canonical_url, payload, payload_checksum, fetched_at)
  values (p_candidate_id, p_source, nullif(p_external_id, ''), p_canonical_url, p_payload, p_payload_checksum, p_fetched_at)
  on conflict (candidate_id, source, canonical_url, payload_checksum)
  do update set fetched_at = excluded.fetched_at
  returning id into v_raw_id;

  select id, content_checksum into v_job_id, v_old_checksum
  from public.jobs
  where candidate_id = p_candidate_id
    and source = p_source
    and (external_id is not distinct from nullif(p_external_id, '') or (external_id is null and p_external_id is null))
    and (external_id is not null or canonical_url = p_canonical_url)
    and deleted_at is null
  for update;

  v_changed := v_old_checksum is distinct from p_content_checksum;

  if v_job_id is null then
    insert into public.jobs (candidate_id, source, external_id, canonical_url, title, company_name, description, location, employment_type, workplace_type, published_at, expires_at, source_payload_id, content_checksum)
    values (p_candidate_id, p_source, nullif(p_external_id, ''), p_canonical_url, p_title, p_company_name, p_description, p_location, p_employment_type, p_workplace_type, p_published_at, p_expires_at, v_raw_id, p_content_checksum)
    returning id into v_job_id;
  elsif v_changed then
    update public.jobs
    set canonical_url = p_canonical_url, title = p_title, company_name = p_company_name, description = p_description, location = p_location, employment_type = p_employment_type, workplace_type = p_workplace_type, published_at = p_published_at, expires_at = p_expires_at, source_payload_id = v_raw_id, content_checksum = p_content_checksum, updated_at = now()
    where id = v_job_id;
    delete from public.job_skills where job_id = v_job_id;
  end if;

  if v_job_id is not null and (v_changed or v_old_checksum is null) then
    insert into public.job_skills (candidate_id, job_id, display_name, canonical_name, match_method)
    select p_candidate_id, v_job_id, skill.display_name, skill.canonical_name, coalesce(skill.match_method, 'keyword')
    from jsonb_to_recordset(coalesce(p_skills, '[]'::jsonb)) as skill(display_name text, canonical_name text, match_method text)
    on conflict (job_id, canonical_name) do nothing;
  end if;

  return query select v_raw_id, v_job_id, v_changed;
end;
$$;

revoke execute on function public.upsert_job_ingestion(uuid, text, text, text, jsonb, text, timestamptz, text, text, text, text, text, text, timestamptz, timestamptz, text, jsonb) from public;
grant execute on function public.upsert_job_ingestion(uuid, text, text, text, jsonb, text, timestamptz, text, text, text, text, text, text, timestamptz, timestamptz, text, jsonb) to authenticated;
