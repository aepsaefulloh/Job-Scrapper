import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260922162703_job_data_model.sql'), 'utf8');

describe('job schema migration contract', () => {
  it('defines candidate-owned raw, normalized, and skill tables', () => {
    expect(migration).toMatch(/create table public\.jobs_raw/i);
    expect(migration).toMatch(/create table public\.jobs\s*\(/i);
    expect(migration).toMatch(/create table public\.job_skills/i);
    expect(migration).toMatch(/candidate_id uuid not null references public\.candidates/i);
    expect(migration).toMatch(/unique \(job_id, canonical_name\)/i);
  });

  it('enables ownership RLS and authenticated-only access', () => {
    expect((migration.match(/enable row level security/gi) ?? []).length).toBe(3);
    expect(migration).toMatch(/auth\.uid\(\)[^\n]*\)\s*=\s*candidate_id/i);
    expect(migration).toMatch(/grant select, insert, update on public\.jobs_raw to authenticated/i);
    expect(migration).toMatch(/revoke execute on function public\.upsert_job_ingestion/i);
    expect(migration).toMatch(/security invoker/i);
  });
});
