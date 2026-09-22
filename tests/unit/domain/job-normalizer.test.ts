import { describe, expect, it } from 'vitest';
import { JobValidationError } from '../../../src/domain/job/job-errors.js';
import { canonicalizeJobUrl, normalizeJob } from '../../../src/domain/job/job-normalizer.js';

const fetchedAt = '2026-09-22T00:00:00.000Z';

describe('job normalizer', () => {
  it('removes tracking parameters and trailing slash from a job URL', () => {
    expect(canonicalizeJobUrl('https://example.com/jobs/42/?utm_source=x')).toBe('https://example.com/jobs/42');
  });

  it('normalizes required and optional fields', () => {
    const result = normalizeJob({
      source: 'example',
      url: 'https://example.com/jobs/42',
      fetchedAt,
      payload: {
        title: '  Senior Engineer ',
        company: ' Example Co ',
        description: ' Build things. ',
        location: ' Jakarta ',
        employmentType: ' Full-time ',
        workplaceType: ' Hybrid ',
        publishedAt: '2026-09-20T00:00:00.000Z',
      },
    });

    expect(result.title).toBe('Senior Engineer');
    expect(result.companyName).toBe('Example Co');
    expect(result.description).toBe('Build things.');
    expect(result.location).toBe('Jakarta');
    expect(result.publishedAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('rejects payloads without required fields', () => {
    expect(() => normalizeJob({ source: 'example', url: 'https://example.com/1', fetchedAt, payload: {} }))
      .toThrow(JobValidationError);
  });
});
