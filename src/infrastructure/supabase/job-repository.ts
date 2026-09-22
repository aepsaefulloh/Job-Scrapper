import type { SupabaseClient } from '@supabase/supabase-js';
import { JobPersistenceError } from '../../domain/job/job-errors.js';
import type { JobIngestionRecord, JobIngestionResult } from '../../domain/job/job-types.js';
import type { Database } from './database.types.js';

export interface JobRepository {
  persist(record: JobIngestionRecord): Promise<JobIngestionResult>;
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
    return { rawId: data.raw_id, jobId: data.job_id, changed: data.changed };
  }
}
