import { describe, expect, it, vi } from 'vitest';
import { JobService } from '../../../src/services/job-service.js';

describe('JobService', () => {
  it('delegates delete and cleanup to repository', async () => {
    const deleteJob = vi.fn().mockResolvedValue(true);
    const cleanupUnsavedJobs = vi.fn().mockResolvedValue({
      deletedJobsCount: 10,
      deletedRawCount: 10,
      deletedScrapeRunsCount: 2,
      preservedJobsCount: 1,
    });

    const repo = {
      listJobs: vi.fn(),
      getJobById: vi.fn(),
      updateJob: vi.fn(),
      deleteJob,
      cleanupUnsavedJobs,
    } as any;

    const service = new JobService(repo);

    const deleteResult = await service.delete('cand-1', 'job-1');
    expect(deleteResult).toBe(true);
    expect(deleteJob).toHaveBeenCalledWith('cand-1', 'job-1');

    const cleanupResult = await service.cleanup('cand-1');
    expect(cleanupResult.deletedJobsCount).toBe(10);
    expect(cleanupUnsavedJobs).toHaveBeenCalledWith('cand-1');
  });
});
