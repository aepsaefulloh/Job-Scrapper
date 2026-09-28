import { describe, expect, it } from 'bun:test';
import {
  filterJobForLlm,
  filterJobsForLlm,
  type FilterableJob,
} from '../../src/search/pre-llm-job-filter.js';
import type { JobSearchPreferences } from '../../src/search/preferences-types.js';

describe('PreLlmJobFilter', () => {
  const baseJob: FilterableJob = {
    id: 'job-1',
    title: 'Senior Software Engineer',
    companyName: 'Tech Corp',
    source: 'jobstreet',
    status: 'active',
    location: 'Jakarta, Indonesia',
    employmentType: 'full-time',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  };

  const preferences: JobSearchPreferences = {
    maxPostingAgeDays: 14,
    sources: ['jobstreet'],
    locations: ['Jakarta', 'Remote'],
    excludedRoles: ['Manager', 'Director'],
    employmentTypes: ['full-time'],
    unknownPostingDatePolicy: 'allow',
  };

  it('accepts job matching all deterministic criteria', () => {
    const res = filterJobForLlm(baseJob, preferences);
    expect(res.eligible).toBe(true);
  });

  it('rejects expired or closed jobs', () => {
    const resExpired = filterJobForLlm({ ...baseJob, status: 'expired' }, preferences);
    expect(resExpired.eligible).toBe(false);
    expect(resExpired.reason).toBe('STATUS_NOT_ACTIVE');

    const resClosed = filterJobForLlm({ ...baseJob, status: 'closed' }, preferences);
    expect(resClosed.eligible).toBe(false);
    expect(resClosed.reason).toBe('STATUS_NOT_ACTIVE');
  });

  it('rejects jobs older than maxPostingAgeDays', () => {
    const oldJob: FilterableJob = {
      ...baseJob,
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    };
    const res = filterJobForLlm(oldJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('POSTING_TOO_OLD');
  });

  it('rejects jobs with excluded roles matching title case-insensitively', () => {
    const managerJob: FilterableJob = {
      ...baseJob,
      title: 'Engineering Manager',
    };
    const res = filterJobForLlm(managerJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('ROLE_EXCLUDED');
  });

  it('rejects jobs from unselected sources', () => {
    const linkedinJob: FilterableJob = {
      ...baseJob,
      source: 'linkedin',
    };
    const res = filterJobForLlm(linkedinJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('SOURCE_NOT_SELECTED');
  });

  it('rejects jobs outside preferred locations when locations are specified', () => {
    const baliJob: FilterableJob = {
      ...baseJob,
      location: 'Bali, Indonesia',
    };
    const res = filterJobForLlm(baliJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('LOCATION_MISMATCH');
  });

  it('filters a batch of jobs returning only eligible ones', () => {
    const jobs: FilterableJob[] = [
      baseJob,
      { ...baseJob, id: 'job-2', title: 'Product Manager' },
      { ...baseJob, id: 'job-3', status: 'expired' },
      { ...baseJob, id: 'job-4', title: 'Backend Developer' },
    ];
    const eligible = filterJobsForLlm(jobs, preferences);
    expect(eligible.map((j) => j.id)).toEqual(['job-1', 'job-4']);
  });
});
