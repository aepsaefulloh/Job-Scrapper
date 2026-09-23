import type { SupabaseClient } from '@supabase/supabase-js';
import { JobPersistenceError } from '../../domain/job/job-errors.js';
import type { JobIngestionRecord, JobIngestionResult } from '../../domain/job/job-types.js';
import type { Database } from './database.types.js';

export interface JobRepository {
  persist(record: JobIngestionRecord): Promise<JobIngestionResult>;
  listJobs?(candidateId: string, query: { limit: number; offset: number; source?: string; company?: string; keyword?: string }): Promise<{ items: unknown[]; total: number }>;
  getJobById?(candidateId: string, jobId: string): Promise<unknown | null>;
  updateJob?(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }): Promise<unknown | null>;
  findJobsMissingEmbedding?(candidateId: string, limit: number): Promise<Array<{ id: string }>>;
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
}
