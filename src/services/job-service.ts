import type { JobRepository } from '../infrastructure/supabase/job-repository.js';
export class JobService {
  public constructor(private readonly repository: Required<Pick<JobRepository, 'listJobs' | 'getJobById' | 'updateJob'>>) {}
  public list(candidateId: string, query: Parameters<NonNullable<JobRepository['listJobs']>>[1]) { return this.repository.listJobs(candidateId, query); }
  public detail(candidateId: string, jobId: string) { return this.repository.getJobById(candidateId, jobId); }
  public update(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }) { return this.repository.updateJob(candidateId, jobId, patch); }
}
