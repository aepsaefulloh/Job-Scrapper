import { describe, expect, it } from 'bun:test';
import { RecommendationPipeline } from '../../../src/matching/recommendation-pipeline.js';
import type { EvaluationCacheRepository, ReadyAiMatchAnalysis } from '../../../src/matching/evaluation-cache.repository.js';
import type { MatchingRepository } from '../../../src/matching/matching.repository.js';
import type { LlmService } from '../../../src/ai/completion/llm.service.js';

describe('RecommendationPipeline', () => {
  const candidateId = 'cand-123';
  const profileChecksum = 'prof-sha256';

  const mockMatchingRepo: Pick<
    MatchingRepository,
    'getCandidateContext' | 'getJobContext' | 'matchSubset' | 'getProfileEmbedding'
  > = {
    async getProfileEmbedding() {
      return [0.1, 0.2];
    },
    async getCandidateContext() {
      return {
        text: 'Software Engineer TypeScript',
        scoring: { headline: 'Software Engineer', skills: ['typescript', 'node.js'] },
      };
    },
    async getJobContext(_candId, jobId) {
      return {
        text: `Job details for ${jobId}`,
        scoring: { title: `Software Engineer ${jobId}`, skills: ['typescript'] },
      };
    },
    async matchSubset(_candId, _emb, jobIds) {
      return jobIds.map((id, idx) => ({ job_id: id, similarity: 0.85 - idx * 0.1 }));
    },
  };

  it('bounds LLM evaluation count to maxJobsPerRun and skips low-score jobs', async () => {
    let llmCallCount = 0;
    const mockLlm: Pick<LlmService, 'completeJson'> = {
      async completeJson() {
        llmCallCount++;
        return {
          score: 80,
          recommendation: 'recommended',
          strengths: ['Skill match'],
          gaps: [],
          summary: 'Fit',
        } as any;
      },
    };

    const cacheMap = new Map<string, ReadyAiMatchAnalysis>();
    const mockCacheRepo: EvaluationCacheRepository = {
      async get(id) {
        return cacheMap.get(id.jobChecksum) ?? null;
      },
      async save(id, _jobId, evalData) {
        cacheMap.set(id.jobChecksum, evalData);
      },
    };

    const pipeline = new RecommendationPipeline(
      mockMatchingRepo as any,
      mockCacheRepo,
      mockLlm as any,
      {
        maxJobsPerRun: 2,
        minVectorScore: 0.6,
        minRuleScore: 20,
      }
    );

    const candidateJobs = [
      { id: 'j1', title: 'Software Engineer 1', source: 'jobstreet', status: 'active', checksum: 'chk-1' },
      { id: 'j2', title: 'Software Engineer 2', source: 'jobstreet', status: 'active', checksum: 'chk-2' },
      { id: 'j3', title: 'Software Engineer 3', source: 'jobstreet', status: 'active', checksum: 'chk-3' },
    ];

    const result = await pipeline.evaluateBatch({
      candidateId,
      profileChecksum,
      jobs: candidateJobs,
    });

    expect(result.metrics.jobsSentToLlm).toBe(2);
    expect(llmCallCount).toBe(2);
    expect(result.metrics.aiCacheMisses).toBe(2);
    expect(result.metrics.aiCacheHits).toBe(0);
    expect(result.recommendations.length).toBe(2);

    // Second run with same jobs should HIT cache without calling LLM
    const secondResult = await pipeline.evaluateBatch({
      candidateId,
      profileChecksum,
      jobs: candidateJobs,
    });

    expect(secondResult.metrics.aiCacheHits).toBe(2);
    expect(secondResult.metrics.aiCacheMisses).toBe(0);
    expect(llmCallCount).toBe(2); // didn't increase!
  });
});
