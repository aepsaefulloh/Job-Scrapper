import { describe, expect, it } from 'vitest';
import { isJobSourceAdapter, type JobSourceAdapter } from '../../../src/domain/job/job-source-adapter.js';

describe('JobSourceAdapter contract', () => {
  it('accepts an adapter without infrastructure dependencies', () => {
    const adapter: JobSourceAdapter = {
      sourceName: 'fixture',
      async *collect() {
        yield { source: 'fixture', url: 'https://example.com/jobs/1', fetchedAt: '2026-09-22T00:00:00.000Z', payload: { title: 'Engineer', company: 'Example', description: 'Build.' } };
      },
    };

    expect(isJobSourceAdapter(adapter)).toBe(true);
  });
});
