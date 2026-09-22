import { describe, expect, it, vi } from 'vitest';
import { SupabaseJobRepository } from '../../../src/infrastructure/supabase/job-repository.js';
import type { JobIngestionRecord } from '../../../src/domain/job/job-types.js';

const record: JobIngestionRecord = {
  candidateId: '00000000-0000-0000-0000-000000000001',
  raw: {
    source: 'example', url: 'https://example.com/jobs/1', canonicalUrl: 'https://example.com/jobs/1',
    fetchedAt: '2026-09-22T00:00:00.000Z', payload: { title: 'Engineer' }, payloadChecksum: 'a'.repeat(64),
  },
  normalized: {
    source: 'example', canonicalUrl: 'https://example.com/jobs/1', title: 'Engineer', companyName: 'Example', description: 'Build.', contentChecksum: 'b'.repeat(64),
  },
  skills: [{ displayName: 'TypeScript', canonicalName: 'typescript', matchMethod: 'keyword' }],
};

describe('SupabaseJobRepository', () => {
  it('sends one authenticated RPC payload and maps its result', async () => {
    const rpc = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { raw_id: 'raw', job_id: 'job', changed: true }, error: null }),
    });
    const repository = new SupabaseJobRepository({ rpc } as never);

    await expect(repository.persist(record)).resolves.toEqual({ rawId: 'raw', jobId: 'job', changed: true });
    expect(rpc).toHaveBeenCalledWith('upsert_job_ingestion', expect.objectContaining({
      p_candidate_id: record.candidateId,
      p_canonical_url: record.normalized.canonicalUrl,
      p_skills: record.skills,
    }));
  });

  it('hides provider error details behind a persistence error', async () => {
    const rpc = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'secret provider detail' } }),
    });
    const repository = new SupabaseJobRepository({ rpc } as never);

    await expect(repository.persist(record)).rejects.toThrow('Job could not be saved.');
    await expect(repository.persist(record)).rejects.not.toThrow('secret provider detail');
  });
});
