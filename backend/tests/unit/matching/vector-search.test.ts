import { describe, expect, it, vi } from 'vitest';
import { SupabaseMatchingRepository } from '../../../src/matching/matching.repository.js';
import { VectorSearchService } from '../../../src/matching/vector-search.service.js';

describe('VectorSearchService', () => {
  it('clamps search count and returns ranked vector matches', async () => {
    const match = vi.fn().mockResolvedValue([{ job_id: 'job-1', similarity: 0.9 }, { job_id: 'job-2', similarity: 0.8 }]);
    const service = new VectorSearchService({ getProfileEmbedding: vi.fn().mockResolvedValue([1, 2]), match, matchSubset: vi.fn() }, { maxLimit: 200 });
    await expect(service.search('candidate', 999, 0.5)).resolves.toEqual([{ jobId: 'job-1', similarity: 0.9 }, { jobId: 'job-2', similarity: 0.8 }]);
    expect(match).toHaveBeenCalledWith('candidate', [1, 2], 200, 0.5);
  });

  it('rejects a missing profile embedding before the repository call', async () => {
    const match = vi.fn();
    const service = new VectorSearchService({ getProfileEmbedding: vi.fn().mockResolvedValue(null), match, matchSubset: vi.fn() }, { maxLimit: 200 });
    await expect(service.search('candidate', 10, 0.5)).rejects.toThrow('Candidate profile embedding is not ready.');
    expect(match).not.toHaveBeenCalled();
  });

  it('deduplicates subset job IDs and clamps the requested count', async () => {
    const matchSubset = vi.fn().mockResolvedValue([
      { job_id: 'job-1', similarity: 0.91 },
      { job_id: 'job-2', similarity: 0.82 },
    ]);
    const getProfileEmbedding = vi.fn().mockResolvedValue([1, 2]);
    const service = new VectorSearchService(
      { getProfileEmbedding, match: vi.fn(), matchSubset },
      { maxLimit: 50 }
    );

    await expect(
      service.searchSubset('candidate', ['job-1', 'job-1', 'job-2'], 999, 0.6)
    ).resolves.toEqual([
      { jobId: 'job-1', similarity: 0.91 },
      { jobId: 'job-2', similarity: 0.82 },
    ]);
    expect(matchSubset).toHaveBeenCalledWith(
      'candidate',
      [1, 2],
      ['job-1', 'job-2'],
      50,
      0.6
    );
  });

  it('returns an empty subset without loading an embedding or calling the RPC', async () => {
    const getProfileEmbedding = vi.fn();
    const matchSubset = vi.fn();
    const service = new VectorSearchService(
      { getProfileEmbedding, match: vi.fn(), matchSubset },
      { maxLimit: 200 }
    );

    await expect(service.searchSubset('candidate', [], 20, 0.6)).resolves.toEqual([]);
    expect(getProfileEmbedding).not.toHaveBeenCalled();
    expect(matchSubset).not.toHaveBeenCalled();
  });

  it('calls the candidate-owned subset RPC with exact parameters', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ job_id: 'job-1', similarity: 0.9 }],
      error: null,
    });
    const repository = new SupabaseMatchingRepository({ rpc } as any);

    await expect(
      repository.matchSubset('candidate', [1, 2], ['job-1'], 20, 0.6)
    ).resolves.toEqual([{ job_id: 'job-1', similarity: 0.9 }]);
    expect(rpc).toHaveBeenCalledWith('match_candidate_job_subset', {
      p_candidate_id: 'candidate',
      p_query_embedding: [1, 2],
      p_job_ids: ['job-1'],
      p_match_count: 20,
      p_match_threshold: 0.6,
    });
  });
});
