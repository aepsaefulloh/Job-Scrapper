import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useJobs } from '../useJobs';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useJobs delete and cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes job optimistically on deleteJob', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true, jobId: 'job-1' });
    const { jobs, total, deleteJob } = useJobs();
    jobs.value = [
      { id: 'job-1', title: 'Developer' } as any,
      { id: 'job-2', title: 'Designer' } as any,
    ];
    total.value = 2;

    const ok = await deleteJob('job-1');
    expect(ok).toBe(true);
    expect(jobs.value).toHaveLength(1);
    expect(jobs.value[0].id).toBe('job-2');
    expect(total.value).toBe(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/jobs/job-1');
  });

  it('calls cleanupJobs and refreshes list', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 1,
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });

    const { cleanupJobs } = useJobs();
    const result = await cleanupJobs();

    expect(result.deletedJobsCount).toBe(5);
    expect(apiClient.post).toHaveBeenCalledWith('/jobs/cleanup');
    expect(apiClient.get).toHaveBeenCalled();
  });
});
