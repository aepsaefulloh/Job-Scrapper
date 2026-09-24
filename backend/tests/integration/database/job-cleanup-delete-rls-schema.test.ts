import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260924094121_add_job_cleanup_delete_policies.sql'),
  'utf8'
);

describe('job cleanup delete RLS migration', () => {
  it('allows an authenticated candidate to delete only their own cleanup data', () => {
    for (const table of ['jobs', 'jobs_raw', 'scrape_runs']) {
      expect(migration).toMatch(new RegExp(`grant delete on public\\.${table} to authenticated`, 'i'));
      expect(migration).toMatch(new RegExp(`on public\\.${table} for delete to authenticated`, 'i'));
    }
    expect(migration).toContain('using ((select auth.uid()) = candidate_id)');
  });
});
