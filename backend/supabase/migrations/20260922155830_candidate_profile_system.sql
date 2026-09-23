create table public.candidates (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  storage_path text not null unique,
  checksum char(64) not null check (checksum ~ '^[a-f0-9]{64}$'),
  byte_size integer not null check (byte_size > 0),
  parser_version text not null,
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index profile_documents_candidate_id_idx on public.profile_documents (candidate_id);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  source_document_id uuid not null unique references public.profile_documents (id) on delete restrict,
  display_name text not null,
  headline text,
  summary text,
  experience text,
  career_preferences text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index profiles_candidate_id_idx on public.profiles (candidate_id);
create unique index profiles_one_active_per_candidate
  on public.profiles (candidate_id)
  where is_active = true and deleted_at is null;

create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  canonical_name text not null,
  category text,
  proficiency text,
  created_at timestamptz not null default now(),
  unique (profile_id, canonical_name)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-profile-documents',
  'candidate-profile-documents',
  false,
  1048576,
  array['text/markdown', 'text/plain']
)
on conflict (id) do nothing;

grant select, insert, update on public.candidates to authenticated;
grant select, insert, update on public.profile_documents to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_skills to authenticated;

alter table public.candidates enable row level security;
alter table public.profile_documents enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_skills enable row level security;

create policy "Candidates can read their own row"
  on public.candidates for select to authenticated
  using ((select auth.uid()) = id);

create policy "Candidates can create their own row"
  on public.candidates for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Candidates can update their own row"
  on public.candidates for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Candidates can read their own documents"
  on public.profile_documents for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own documents"
  on public.profile_documents for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own documents"
  on public.profile_documents for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can read their own profiles"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own profiles"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own profiles"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can read skills for their own profiles"
  on public.profile_skills for select to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.candidate_id = (select auth.uid())
    )
  );

create policy "Candidates can create skills for their own profiles"
  on public.profile_skills for insert to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.candidate_id = (select auth.uid())
    )
  );

create policy "Candidates can update skills for their own profiles"
  on public.profile_skills for update to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.candidate_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.candidate_id = (select auth.uid())
    )
  );

create policy "Candidates can read their own profile objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'candidate-profile-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Candidates can upload their own profile objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'candidate-profile-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Candidates can delete their own profile objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'candidate-profile-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.create_profile_revision(
  p_storage_path text,
  p_checksum text,
  p_byte_size integer,
  p_parser_version text,
  p_display_name text,
  p_headline text,
  p_summary text,
  p_experience text,
  p_career_preferences text,
  p_skills jsonb
)
returns table (
  document_id uuid,
  profile_id uuid,
  uploaded_at timestamptz,
  checksum text,
  skill_count integer
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_candidate_id uuid := auth.uid();
  v_document_id uuid;
  v_profile_id uuid;
  v_uploaded_at timestamptz;
  v_skill_count integer;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if split_part(p_storage_path, '/', 1) <> v_candidate_id::text then
    raise exception 'Storage path does not belong to the authenticated candidate.' using errcode = '42501';
  end if;

  insert into public.candidates (id)
  values (v_candidate_id)
  on conflict (id) do nothing;

  perform 1
  from public.candidates
  where id = v_candidate_id
  for update;

  update public.profiles
  set is_active = false,
      updated_at = now()
  where candidate_id = v_candidate_id
    and is_active = true
    and deleted_at is null;

  insert into public.profile_documents (
    candidate_id,
    storage_path,
    checksum,
    byte_size,
    parser_version
  )
  values (
    v_candidate_id,
    p_storage_path,
    p_checksum,
    p_byte_size,
    p_parser_version
  )
  returning profile_documents.id, profile_documents.uploaded_at into v_document_id, v_uploaded_at;

  insert into public.profiles (
    candidate_id,
    source_document_id,
    display_name,
    headline,
    summary,
    experience,
    career_preferences
  )
  values (
    v_candidate_id,
    v_document_id,
    p_display_name,
    p_headline,
    p_summary,
    p_experience,
    p_career_preferences
  )
  returning profiles.id into v_profile_id;

  insert into public.profile_skills (
    profile_id,
    display_name,
    canonical_name,
    category,
    proficiency
  )
  select
    v_profile_id,
    skill.display_name,
    skill.canonical_name,
    skill.category,
    skill.proficiency
  from jsonb_to_recordset(p_skills) as skill (
    display_name text,
    canonical_name text,
    category text,
    proficiency text
  );

  get diagnostics v_skill_count = row_count;

  return query
  select v_document_id, v_profile_id, v_uploaded_at, p_checksum, v_skill_count;
end;
$$;

revoke execute on function public.create_profile_revision(text, text, integer, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_profile_revision(text, text, integer, text, text, text, text, text, text, jsonb) to authenticated;
