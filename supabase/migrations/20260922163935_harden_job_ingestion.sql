create or replace function public.prevent_job_raw_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.candidate_id is distinct from old.candidate_id
     or new.source is distinct from old.source
     or new.external_id is distinct from old.external_id
     or new.canonical_url is distinct from old.canonical_url
     or new.payload is distinct from old.payload
     or new.payload_checksum is distinct from old.payload_checksum
     or new.fetched_at is distinct from old.fetched_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Raw job observations are immutable.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_raw_immutable_trigger on public.jobs_raw;
create trigger jobs_raw_immutable_trigger
before update on public.jobs_raw
for each row execute function public.prevent_job_raw_mutation();

drop policy if exists "Candidates can read their own job skills" on public.job_skills;
drop policy if exists "Candidates can create their own job skills" on public.job_skills;
drop policy if exists "Candidates can update their own job skills" on public.job_skills;
drop policy if exists "Candidates can delete their own job skills" on public.job_skills;
create policy "Candidates can read their own job skills"
  on public.job_skills for select to authenticated
  using ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.candidate_id = (select auth.uid())));
create policy "Candidates can create their own job skills"
  on public.job_skills for insert to authenticated
  with check ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.candidate_id = (select auth.uid())));
create policy "Candidates can update their own job skills"
  on public.job_skills for update to authenticated
  using ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.candidate_id = (select auth.uid())))
  with check ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.candidate_id = (select auth.uid())));
create policy "Candidates can delete their own job skills"
  on public.job_skills for delete to authenticated
  using ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs where jobs.id = job_skills.job_id and jobs.candidate_id = (select auth.uid())));

drop policy if exists "Candidates can create their own jobs" on public.jobs;
drop policy if exists "Candidates can update their own jobs" on public.jobs;
create policy "Candidates can create their own jobs"
  on public.jobs for insert to authenticated
  with check ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs_raw where jobs_raw.id = source_payload_id and jobs_raw.candidate_id = (select auth.uid())));
create policy "Candidates can update their own jobs"
  on public.jobs for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id and exists (select 1 from public.jobs_raw where jobs_raw.id = source_payload_id and jobs_raw.candidate_id = (select auth.uid())));

revoke update on public.jobs_raw from authenticated;

create or replace function public.upsert_job_ingestion(
  p_candidate_id uuid, p_source text, p_external_id text, p_canonical_url text, p_payload jsonb,
  p_payload_checksum text, p_fetched_at timestamptz, p_title text, p_company_name text,
  p_description text, p_location text, p_employment_type text, p_workplace_type text,
  p_published_at timestamptz, p_expires_at timestamptz, p_content_checksum text, p_skills jsonb
)
returns table (raw_id uuid, job_id uuid, changed boolean)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare v_raw_id uuid; v_job_id uuid; v_old_checksum text; v_changed boolean;
begin
  if auth.uid() is null or auth.uid() <> p_candidate_id then raise exception 'Candidate authentication mismatch.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text || ':' || p_source || ':' || coalesce(p_external_id, p_canonical_url), 0));
  insert into public.candidates (id) values (p_candidate_id) on conflict (id) do nothing;
  insert into public.jobs_raw (candidate_id, source, external_id, canonical_url, payload, payload_checksum, fetched_at)
  values (p_candidate_id, p_source, nullif(p_external_id, ''), p_canonical_url, p_payload, p_payload_checksum, p_fetched_at)
  on conflict (candidate_id, source, canonical_url, payload_checksum) do nothing;
  select id into v_raw_id from public.jobs_raw where candidate_id = p_candidate_id and source = p_source and canonical_url = p_canonical_url and payload_checksum = p_payload_checksum;
  select id, content_checksum into v_job_id, v_old_checksum from public.jobs where candidate_id = p_candidate_id and source = p_source and (external_id is not distinct from nullif(p_external_id, '') or (external_id is null and p_external_id is null)) and (external_id is not null or canonical_url = p_canonical_url) and deleted_at is null for update;
  v_changed := v_old_checksum is distinct from p_content_checksum;
  if v_job_id is null then
    insert into public.jobs (candidate_id, source, external_id, canonical_url, title, company_name, description, location, employment_type, workplace_type, published_at, expires_at, source_payload_id, content_checksum)
    values (p_candidate_id, p_source, nullif(p_external_id, ''), p_canonical_url, p_title, p_company_name, p_description, p_location, p_employment_type, p_workplace_type, p_published_at, p_expires_at, v_raw_id, p_content_checksum) returning id into v_job_id;
  elsif v_changed then
    update public.jobs set canonical_url = p_canonical_url, title = p_title, company_name = p_company_name, description = p_description, location = p_location, employment_type = p_employment_type, workplace_type = p_workplace_type, published_at = p_published_at, expires_at = p_expires_at, source_payload_id = v_raw_id, content_checksum = p_content_checksum, updated_at = now() where id = v_job_id;
    delete from public.job_skills where job_skills.job_id = v_job_id;
  end if;
  if v_changed or v_old_checksum is null then
    insert into public.job_skills (candidate_id, job_id, display_name, canonical_name, match_method)
    select
      p_candidate_id,
      v_job_id,
      coalesce(skill.display_name, skill."displayName"),
      coalesce(skill.canonical_name, skill."canonicalName"),
      coalesce(skill.match_method, skill."matchMethod", 'keyword')
    from jsonb_to_recordset(coalesce(p_skills, '[]'::jsonb))
      as skill(display_name text, "displayName" text, canonical_name text, "canonicalName" text, match_method text, "matchMethod" text)
    on conflict (job_id, canonical_name) do nothing;
  end if;
  return query select v_raw_id, v_job_id, v_changed;
end;
$$;
