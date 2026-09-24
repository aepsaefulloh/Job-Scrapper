import { describe, expect, it, vi } from 'vitest';
import {
  SupabaseEvaluationCacheRepository,
  type EvaluationCacheIdentity,
} from '../../../src/matching/evaluation-cache.repository.js';

const identity: EvaluationCacheIdentity = {
  candidateId: 'candidate-1',
  profileChecksum: 'a'.repeat(64),
  jobChecksum: 'b'.repeat(64),
  promptVersion: 'job-match-v2',
  model: 'model-x',
};

const readyAnalysis = {
  status: 'ready' as const,
  score: 82,
  recommendation: 'strong_match' as const,
  strengths: ['Strong TypeScript'],
  gaps: ['No AWS evidence'],
  summary: 'Good fit for the core backend responsibilities.',
};

describe('SupabaseEvaluationCacheRepository', () => {
  it('loads a valid evaluation by the complete candidate-scoped identity', async () => {
    const query: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { evaluation: readyAnalysis },
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) } as any;
    const repo = new SupabaseEvaluationCacheRepository(client);

    await expect(repo.get(identity)).resolves.toEqual(readyAnalysis);
    expect(client.from).toHaveBeenCalledWith('ai_match_evaluations');
    expect(query.eq).toHaveBeenCalledWith('candidate_id', 'candidate-1');
    expect(query.eq).toHaveBeenCalledWith('profile_checksum', 'a'.repeat(64));
    expect(query.eq).toHaveBeenCalledWith('job_checksum', 'b'.repeat(64));
    expect(query.eq).toHaveBeenCalledWith('prompt_version', 'job-match-v2');
    expect(query.eq).toHaveBeenCalledWith('model', 'model-x');
  });

  it('treats a missing or invalid stored evaluation as a cache miss', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { evaluation: { ...readyAnalysis, score: 200 } }, error: null });
    const query: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const repo = new SupabaseEvaluationCacheRepository({ from: vi.fn().mockReturnValue(query) } as any);

    await expect(repo.get(identity)).resolves.toBeNull();
    await expect(repo.get(identity)).resolves.toBeNull();
  });

  it('upserts only a ready evaluation using the cache identity conflict target', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as any;
    const repo = new SupabaseEvaluationCacheRepository(client);

    await repo.save(identity, 'job-1', readyAnalysis);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate_id: 'candidate-1',
        job_id: 'job-1',
        profile_checksum: 'a'.repeat(64),
        job_checksum: 'b'.repeat(64),
        prompt_version: 'job-match-v2',
        model: 'model-x',
        evaluation: readyAnalysis,
      }),
      { onConflict: 'candidate_id,profile_checksum,job_checksum,prompt_version,model' }
    );
  });
});
