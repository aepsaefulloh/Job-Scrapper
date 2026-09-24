import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260924140000_ai_match_evaluation_cache.sql'),
  'utf8'
);
const correctiveMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260924140001_ai_match_evaluations_job_fk_index.sql'
);

describe('AI match cache migration contract', () => {
  it('creates a candidate-owned cache with a stable identity', () => {
    expect(migration).toContain('create table public.ai_match_evaluations');
    expect(migration).toContain(
      'unique (candidate_id, profile_checksum, job_checksum, prompt_version, model)'
    );
    expect(migration).toContain(
      'alter table public.ai_match_evaluations enable row level security'
    );
    expect(migration).toMatch(/for update\s+to authenticated[\s\S]*using[\s\S]*with check/i);
  });

  it('defines an authenticated ownership-filtered subset vector RPC', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain('p_job_ids uuid[]');
    expect(migration).toContain('jobs.id = any(p_job_ids)');
    expect(migration).toContain('auth.uid() = p_candidate_id');
    expect(migration).toContain('limit least(greatest(p_match_count, 1), 200)');
    expect(migration).toMatch(/revoke execute[\s\S]*from public/i);
    expect(migration).toMatch(/grant execute[\s\S]*to authenticated/i);
  });

  it('covers the job foreign key with a dedicated index', () => {
    const correctiveMigration = readFileSync(correctiveMigrationPath, 'utf8');
    expect(correctiveMigration).toMatch(
      /create index ai_match_evaluations_job_id_idx\s+on public\.ai_match_evaluations \(job_id\)/i
    );
  });
});
