import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260923100000_scrape_runs.sql'), 'utf8');
describe('scrape run schema migration contract', () => {
  it('creates candidate-owned operational run tracking with RLS and an active-run index', () => {
    expect(migration).toMatch(/create table public\.scrape_runs/i);
    expect(migration).toMatch(/candidate_id uuid not null references public\.candidates/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/\(select auth\.uid\(\)\) = candidate_id/i);
    expect(migration).toMatch(/where status in \('pending', 'running'\)/i);
  });
});
