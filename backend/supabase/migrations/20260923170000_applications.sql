create table public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null check (status in ('saved', 'applied', 'interview', 'rejected', 'offer')) default 'saved',
  notes text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index applications_candidate_created_idx on public.applications (candidate_id, created_at desc);
create index applications_candidate_status_idx on public.applications (candidate_id, status);
create index applications_job_id_idx on public.applications (job_id);
create unique index applications_candidate_job_active_idx on public.applications (candidate_id, job_id) where deleted_at is null;

grant select, insert, update, delete on public.applications to authenticated;
alter table public.applications enable row level security;

create policy "Candidates can read their own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own applications"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own applications"
  on public.applications for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own applications"
  on public.applications for delete to authenticated
  using ((select auth.uid()) = candidate_id);

create table public.application_materials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  material_type text not null check (material_type in ('cover_letter', 'introduction', 'recruiter_answer')),
  content text not null check (length(trim(content)) > 0),
  prompt_input text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index application_materials_app_created_idx on public.application_materials (application_id, created_at desc);
create index application_materials_candidate_created_idx on public.application_materials (candidate_id, created_at desc);

grant select, insert, update, delete on public.application_materials to authenticated;
alter table public.application_materials enable row level security;

create policy "Candidates can read their own application materials"
  on public.application_materials for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own application materials"
  on public.application_materials for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own application materials"
  on public.application_materials for delete to authenticated
  using ((select auth.uid()) = candidate_id);
