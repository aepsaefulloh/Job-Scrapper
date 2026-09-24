import type { SupabaseClient } from '@supabase/supabase-js';
import { JobPersistenceError } from '../../domain/job/job-errors.js';
import type { JobIngestionRecord, JobIngestionResult } from '../../domain/job/job-types.js';
import type { Database } from './database.types.js';

export interface CleanupResult {
  deletedJobsCount: number;
  deletedRawCount: number;
  deletedScrapeRunsCount: number;
  preservedJobsCount: number;
}

export interface JobRepository {
  persist(record: JobIngestionRecord): Promise<JobIngestionResult>;
  listJobs?(candidateId: string, query: { limit: number; offset: number; source?: string; company?: string; keyword?: string }): Promise<{ items: unknown[]; total: number }>;
  getJobById?(candidateId: string, jobId: string): Promise<unknown | null>;
  updateJob?(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }): Promise<unknown | null>;
  findJobsMissingEmbedding?(candidateId: string, limit: number): Promise<Array<{ id: string }>>;
  deleteJob?(candidateId: string, jobId: string): Promise<boolean>;
  cleanupUnsavedJobs?(candidateId: string): Promise<CleanupResult>;
}

export class SupabaseJobRepository implements JobRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async persist(record: JobIngestionRecord): Promise<JobIngestionResult> {
    const { data, error } = await this.client.rpc('upsert_job_ingestion', {
      p_candidate_id: record.candidateId,
      p_source: record.raw.source,
      p_external_id: record.normalized.externalId ?? null,
      p_canonical_url: record.normalized.canonicalUrl,
      p_payload: record.raw.payload,
      p_payload_checksum: record.raw.payloadChecksum,
      p_fetched_at: record.raw.fetchedAt,
      p_title: record.normalized.title,
      p_company_name: record.normalized.companyName,
      p_description: record.normalized.description,
      p_location: record.normalized.location ?? null,
      p_employment_type: record.normalized.employmentType ?? null,
      p_workplace_type: record.normalized.workplaceType ?? null,
      p_published_at: record.normalized.publishedAt ?? null,
      p_expires_at: record.normalized.expiresAt ?? null,
      p_content_checksum: record.normalized.contentChecksum,
      p_skills: record.skills,
    } as never).single();

    if (error || !data) throw new JobPersistenceError('Job could not be saved.');
    const result = data as unknown as { raw_id: string; job_id: string; changed: boolean; created?: unknown };
    return { rawId: result.raw_id, jobId: result.job_id, changed: result.changed, ...(typeof result.created === 'boolean' ? { created: result.created } : {}) };
  }
  public async listJobs(candidateId: string, query: { limit: number; offset: number; source?: string; company?: string; keyword?: string }): Promise<{ items: unknown[]; total: number }> {
    let request = this.client.from('jobs').select('id,title,company_name,source,location,canonical_url,published_at,created_at', { count: 'exact' }).eq('candidate_id', candidateId).is('deleted_at', null).range(query.offset, query.offset + query.limit - 1).order('created_at', { ascending: false });
    if (query.source) request = request.eq('source', query.source); if (query.company) request = request.ilike('company_name', `%${query.company}%`); if (query.keyword) request = request.or(`title.ilike.%${query.keyword}%,description.ilike.%${query.keyword}%`);
    const { data, count, error } = await request; if (error) throw new JobPersistenceError('Jobs could not be loaded.'); return { items: data ?? [], total: count ?? 0 };
  }
  public async getJobById(candidateId: string, jobId: string): Promise<unknown | null> {
    const { data, error } = await this.client.from('jobs').select('id,title,company_name,source,location,canonical_url,description,employment_type,workplace_type,published_at,status,created_at,job_skills(display_name,canonical_name)').eq('candidate_id', candidateId).eq('id', jobId).is('deleted_at', null).maybeSingle(); if (error) throw new JobPersistenceError('Job could not be loaded.'); return data;
  }
  public async updateJob(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }): Promise<unknown | null> {
    const { data, error } = await this.client.from('jobs').update(patch).eq('candidate_id', candidateId).eq('id', jobId).is('deleted_at', null).select('id,title,company_name,source,location,canonical_url,status,created_at').maybeSingle(); if (error) throw new JobPersistenceError('Job could not be updated.'); return data;
  }
  public async findJobsMissingEmbedding(candidateId: string, limit: number): Promise<Array<{ id: string }>> {
    const bounded = Math.min(Math.max(limit, 1), 100);
    const { data, error } = await this.client.from('jobs').select('id').eq('candidate_id', candidateId).is('deleted_at', null).or('embedding.is.null,embedding_status.neq.ready').limit(bounded);
    if (error) throw new JobPersistenceError('Jobs missing embeddings could not be loaded.'); return data ?? [];
  }

  public async deleteJob(candidateId: string, jobId: string): Promise<boolean> {
    const { data: job, error: findError } = await this.client
      .from('jobs')
      .select('id, source_payload_id')
      .eq('candidate_id', candidateId)
      .eq('id', jobId)
      .maybeSingle();

    if (findError) throw new JobPersistenceError('Failed to check job for deletion.');
    if (!job) return false;

    const sourcePayloadId = (job as { source_payload_id?: string }).source_payload_id;

    const { error: deleteError } = await this.client
      .from('jobs')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('id', jobId);

    if (deleteError) throw new JobPersistenceError('Failed to delete job.');

    if (sourcePayloadId) {
      const { count } = await this.client
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('source_payload_id', sourcePayloadId);

      if (count === 0) {
        await this.client
          .from('jobs_raw')
          .delete()
          .eq('candidate_id', candidateId)
          .eq('id', sourcePayloadId);
      }
    }

    return true;
  }

  public async cleanupUnsavedJobs(candidateId: string): Promise<CleanupResult> {
    const { data: applied, error: appError } = await this.client
      .from('applications')
      .select('job_id')
      .eq('candidate_id', candidateId);

    if (appError) throw new JobPersistenceError('Failed to fetch applied jobs.');

    const appliedJobIds = new Set((applied ?? []).map((a: { job_id: string }) => a.job_id));
    const preservedJobsCount = appliedJobIds.size;

    const { data: allJobs, error: jobsError } = await this.client
      .from('jobs')
      .select('id, source_payload_id')
      .eq('candidate_id', candidateId);

    if (jobsError) throw new JobPersistenceError('Failed to fetch jobs for cleanup.');

    const jobsToDelete = (allJobs ?? []).filter((j: { id: string }) => !appliedJobIds.has(j.id));
    const targetJobIds = jobsToDelete.map((j: { id: string }) => j.id);

    let deletedJobsCount = 0;
    if (targetJobIds.length > 0) {
      const { error: delJobsError } = await this.client
        .from('jobs')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', targetJobIds);

      if (delJobsError) throw new JobPersistenceError('Failed to delete unsaved jobs.');
      deletedJobsCount = targetJobIds.length;
    }

    const { data: remainingJobs } = await this.client
      .from('jobs')
      .select('source_payload_id')
      .eq('candidate_id', candidateId);

    const referencedPayloadIds = new Set((remainingJobs ?? []).map((j: { source_payload_id: string }) => j.source_payload_id));

    const { data: allRaw } = await this.client
      .from('jobs_raw')
      .select('id')
      .eq('candidate_id', candidateId);

    const rawToDelete = (allRaw ?? []).filter((r: { id: string }) => !referencedPayloadIds.has(r.id)).map((r: { id: string }) => r.id);

    let deletedRawCount = 0;
    if (rawToDelete.length > 0) {
      const { error: delRawError } = await this.client
        .from('jobs_raw')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', rawToDelete);

      if (!delRawError) deletedRawCount = rawToDelete.length;
    }

    const { data: finishedRuns } = await this.client
      .from('scrape_runs')
      .select('id')
      .eq('candidate_id', candidateId)
      .in('status', ['completed', 'failed', 'partial']);

    let deletedScrapeRunsCount = 0;
    const runIdsToDelete = (finishedRuns ?? []).map((r: { id: string }) => r.id);
    if (runIdsToDelete.length > 0) {
      const { error: delRunsError } = await this.client
        .from('scrape_runs')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', runIdsToDelete);

      if (!delRunsError) deletedScrapeRunsCount = runIdsToDelete.length;
    }

    return {
      deletedJobsCount,
      deletedRawCount,
      deletedScrapeRunsCount,
      preservedJobsCount,
    };
  }
}
