import type { JobRepository, CleanupResult } from '../infrastructure/supabase/job-repository.js';

export class JobService {
  public constructor(
    private readonly repository: Required<Pick<JobRepository, 'listJobs' | 'getJobById' | 'updateJob'>> &
      Pick<JobRepository, 'deleteJob' | 'cleanupUnsavedJobs'>
  ) {}

  public list(candidateId: string, query: Parameters<NonNullable<JobRepository['listJobs']>>[1]) {
    return this.repository.listJobs(candidateId, query);
  }

  public detail(candidateId: string, jobId: string) {
    return this.repository.getJobById(candidateId, jobId);
  }

  public update(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }) {
    return this.repository.updateJob(candidateId, jobId, patch);
  }

  public delete(candidateId: string, jobId: string): Promise<boolean> {
    if (!this.repository.deleteJob) throw new Error('deleteJob not supported by repository');
    return this.repository.deleteJob(candidateId, jobId);
  }

  public cleanup(candidateId: string): Promise<CleanupResult> {
    if (!this.repository.cleanupUnsavedJobs) throw new Error('cleanupUnsavedJobs not supported by repository');
    return this.repository.cleanupUnsavedJobs(candidateId);
  }
}

