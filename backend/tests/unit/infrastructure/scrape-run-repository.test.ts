import { describe, expect, it, vi } from 'vitest';
import { SupabaseScrapeRunRepository } from '../../../src/infrastructure/supabase/scrape-run-repository.js';

function activeRunClient(count: number) {
  const calls: Array<[string, ...unknown[]]> = [];
  const result = { count, error: null };
  const query = {
    select: vi.fn((...args: unknown[]) => { calls.push(['select', ...args]); return query; }),
    eq: vi.fn((...args: unknown[]) => { calls.push(['eq', ...args]); return query; }),
    in: vi.fn((...args: unknown[]) => { calls.push(['in', ...args]); return query; }),
    is: vi.fn((...args: unknown[]) => { calls.push(['is', ...args]); return query; }),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result))
  };
  return { client: { from: vi.fn().mockReturnValue(query) }, calls };
}

describe('SupabaseScrapeRunRepository active-run guard', () => {
  it('checks candidate, normalized search fields, and only active statuses', async () => {
    const { client, calls } = activeRunClient(1);
    const repository = new SupabaseScrapeRunRepository(client as never);

    await expect(repository.hasActiveRun('candidate', { source: 'jobstreet', keyword: 'backend engineer', location: 'indonesia' }, 'identity')).resolves.toBe(true);
    expect(calls).toContainEqual(['eq', 'candidate_id', 'candidate']);
    expect(calls).toContainEqual(['eq', 'source', 'jobstreet']);
    expect(calls).toContainEqual(['eq', 'keyword', 'backend engineer']);
    expect(calls).toContainEqual(['eq', 'location', 'indonesia']);
    expect(calls).toContainEqual(['in', 'status', ['pending', 'running']]);
  });

  it('does not report an active run when the matching search query returns none', async () => {
    const { client } = activeRunClient(0);
    const repository = new SupabaseScrapeRunRepository(client as never);

    await expect(repository.hasActiveRun('candidate', { source: 'jobstreet', keyword: 'different' }, 'identity')).resolves.toBe(false);
  });
});
