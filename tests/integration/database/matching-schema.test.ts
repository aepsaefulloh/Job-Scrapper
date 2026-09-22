import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260922174312_matching_ai_foundation.sql'), 'utf8');

describe('matching schema migration contract', () => {
  it('enables vector embeddings with the fixed 1536 dimension', () => {
    expect(migration).toMatch(/create extension if not exists vector/i);
    expect((migration.match(/vector\(1536\)/gi) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(migration).toMatch(/embedding_status.*pending.*ready.*failed/is);
    expect(migration).toMatch(/using hnsw.*vector_cosine_ops/is);
  });

  it('defines an ownership-filtered bounded matching RPC', () => {
    expect(migration).toMatch(/match_candidate_jobs/i);
    expect(migration).toMatch(/auth\.uid\(\).*p_candidate_id/is);
    expect(migration).toMatch(/least\(p_match_count, 200\)/i);
    expect(migration).toMatch(/embedding_status = 'ready'/i);
    expect(migration).toMatch(/revoke execute on function public\.match_candidate_jobs/i);
  });
});
