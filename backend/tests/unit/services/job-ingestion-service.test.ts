import { describe, expect, it, vi } from 'vitest';
import { JobIngestionService } from '../../../src/services/job-ingestion-service.js';
import type { JobRepository } from '../../../src/infrastructure/supabase/job-repository.js';

const input = {
  source: 'example',
  externalId: '42',
  url: 'https://example.com/jobs/42/?utm_source=test',
  fetchedAt: '2026-09-22T00:00:00.000Z',
  payload: { title: 'Engineer', company: 'Example', description: 'Build TypeScript services.' },
};

describe('JobIngestionService', () => {
  it('builds stable checksums and persists a normalized record', async () => {
    const persist = vi.fn().mockResolvedValue({ rawId: 'raw', jobId: 'job', changed: true });
    const service = new JobIngestionService({ persist } as JobRepository);

    await expect(service.ingest(input, '00000000-0000-0000-0000-000000000001')).resolves.toEqual({ rawId: 'raw', jobId: 'job', changed: true });
    const record = persist.mock.calls[0][0];
    expect(record.raw.canonicalUrl).toBe('https://example.com/jobs/42');
    expect(record.raw.payloadChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(record.normalized.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(record.skills.map((skill: { canonicalName: string }) => skill.canonicalName)).toContain('typescript');
  });

  it('rejects malformed input before repository invocation', async () => {
    const persist = vi.fn();
    const service = new JobIngestionService({ persist } as JobRepository);

    await expect(service.ingest({ ...input, payload: {} }, '00000000-0000-0000-0000-000000000001')).rejects.toThrow('Job payload field');
    expect(persist).not.toHaveBeenCalled();
  });
});
