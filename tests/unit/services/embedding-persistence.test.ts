import { describe, expect, it, vi } from 'vitest';
import { ProfileEmbeddingService } from '../../../src/services/profile-embedding-service.js';
import { JobEmbeddingService } from '../../../src/services/job-embedding-service.js';

describe('embedding persistence services', () => {
  it('persists ready profile embedding metadata', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const service = new ProfileEmbeddingService({ embedText: vi.fn().mockResolvedValue({ vector: [1, 2], model: 'm', dimensions: 2 }) }, { update });
    await service.embed({ id: 'profile', displayName: 'A', headline: 'Engineer', skills: [] });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready', embedding: [1, 2] }));
  });

  it('persists failed job status without deleting job data', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const service = new JobEmbeddingService({ embedText: vi.fn().mockRejectedValue(new Error('provider')) }, { update });
    await expect(service.embed({ id: 'job', title: 'Engineer', companyName: 'Example', description: 'Build' }, [])).rejects.toThrow();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'Embedding generation failed.' }));
  });
});
