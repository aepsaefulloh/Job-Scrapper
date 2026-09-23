import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useJobs } from '../useJobs';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('useJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs list with pagination parameters', async () => {
    const mockJobsResponse = {
      items: [
        {
          id: 'job-1',
          title: 'Senior Frontend Engineer',
          company: 'Tokopedia',
          source: 'jobstreet',
          location: 'Jakarta, Indonesia',
          jobUrl: 'https://example.com/job/1',
          publishedAt: '2026-09-23T00:00:00.000Z',
          createdAt: '2026-09-23T00:00:00.000Z',
        },
      ],
      pagination: { limit: 20, offset: 0, total: 1 },
    };

    (apiClient.get as any).mockResolvedValue(mockJobsResponse);

    const { jobs, total, loading, fetchJobs } = useJobs();
    await fetchJobs({ keyword: 'Frontend', limit: 20, offset: 0 });

    expect(loading.value).toBe(false);
    expect(total.value).toBe(1);
    expect(jobs.value).toHaveLength(1);
    expect(jobs.value[0].title).toBe('Senior Frontend Engineer');
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/jobs?limit=20&offset=0&keyword=Frontend')
    );
  });

  it('fetches job detail by id', async () => {
    const mockDetail = {
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      company: 'Tokopedia',
      source: 'jobstreet',
      location: 'Jakarta, Indonesia',
      jobUrl: 'https://example.com/job/1',
      description: 'Exciting job description here',
      employmentType: 'Full-time',
      workplaceType: 'On-site',
      publishedAt: '2026-09-23T00:00:00.000Z',
      status: 'active',
      skills: [{ displayName: 'Vue.js', canonicalName: 'vuejs' }],
    };

    (apiClient.get as any).mockResolvedValue(mockDetail);

    const { activeJob, fetchJobDetail } = useJobs();
    await fetchJobDetail('job-1');

    expect(activeJob.value).toEqual(mockDetail);
    expect(apiClient.get).toHaveBeenCalledWith('/jobs/job-1');
  });
});
