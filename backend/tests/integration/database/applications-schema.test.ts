import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260923170000_applications.sql'),
  'utf8'
);

describe('applications schema migration contract', () => {
  it('creates candidate-owned applications table with required statuses and RLS', () => {
    expect(migration).toMatch(/create table public\.applications/i);
    expect(migration).toMatch(/candidate_id uuid not null references public\.candidates/i);
    expect(migration).toMatch(/job_id uuid not null references public\.jobs/i);
    expect(migration).toMatch(/check \(status in \('saved', 'applied', 'interview', 'rejected', 'offer'\)\)/i);
    expect(migration).toMatch(/alter table public\.applications enable row level security/i);
    expect(migration).toMatch(/\(select auth\.uid\(\)\) = candidate_id/i);
    expect(migration).toMatch(/applications_candidate_job_active_idx/i);
  });

  it('creates candidate-owned application_materials table with material types and RLS', () => {
    expect(migration).toMatch(/create table public\.application_materials/i);
    expect(migration).toMatch(/application_id uuid not null references public\.applications/i);
    expect(migration).toMatch(/candidate_id uuid not null references public\.candidates/i);
    expect(migration).toMatch(/check \(material_type in \('cover_letter', 'introduction', 'recruiter_answer'\)\)/i);
    expect(migration).toMatch(/alter table public\.application_materials enable row level security/i);
  });
});
