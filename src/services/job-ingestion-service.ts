import { createHash } from 'node:crypto';
import { extractNormalizedJobSkills, normalizeJob } from '../domain/job/job-normalizer.js';
import type { RawJobInput, JobIngestionRecord, JobIngestionResult } from '../domain/job/job-types.js';
import type { JobRepository } from '../infrastructure/supabase/job-repository.js';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class JobIngestionService {
  public constructor(private readonly repository: JobRepository) {}

  public async ingest(input: RawJobInput, candidateId: string, _accessToken?: string): Promise<JobIngestionResult> {
    const normalized = normalizeJob(input);
    const skills = extractNormalizedJobSkills(normalized);
    const content = stableStringify(normalized);
    const record: JobIngestionRecord = {
      candidateId,
      raw: {
        ...input,
        canonicalUrl: normalized.canonicalUrl,
        payloadChecksum: sha256(stableStringify(input.payload)),
      },
      normalized: { ...normalized, contentChecksum: sha256(content) },
      skills,
    };
    return this.repository.persist(record);
  }
}
