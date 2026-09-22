import { describe, expect, it, vi } from 'vitest';
import { VectorSearchService } from '../../../src/matching/vector-search.service.js';

describe('VectorSearchService', () => {
  it('clamps search count and returns ranked vector matches', async () => {
    const match = vi.fn().mockResolvedValue([{ job_id: 'job-1', similarity: 0.9 }, { job_id: 'job-2', similarity: 0.8 }]);
    const service = new VectorSearchService({ getProfileEmbedding: vi.fn().mockResolvedValue([1, 2]), match }, { maxLimit: 200 });
    await expect(service.search('candidate', 999, 0.5)).resolves.toEqual([{ jobId: 'job-1', similarity: 0.9 }, { jobId: 'job-2', similarity: 0.8 }]);
    expect(match).toHaveBeenCalledWith('candidate', [1, 2], 200, 0.5);
  });

  it('rejects a missing profile embedding before the repository call', async () => {
    const match = vi.fn();
    const service = new VectorSearchService({ getProfileEmbedding: vi.fn().mockResolvedValue(null), match }, { maxLimit: 200 });
    await expect(service.search('candidate', 10, 0.5)).rejects.toThrow('Candidate profile embedding is not ready.');
    expect(match).not.toHaveBeenCalled();
  });
});
