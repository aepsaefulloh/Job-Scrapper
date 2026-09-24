import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/config/env.js';

const base = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-key',
  AI_API_KEY: 'secret',
  AI_BASE_URL: 'https://api.sumopod.example/v1',
  AI_CHAT_MODEL: 'chat-model',
};

describe('AI environment configuration', () => {
  it('loads the SumoPod defaults and embedding dimensions', () => {
    const env = loadEnv(base);
    expect(env.aiProvider).toBe('sumopod');
    expect(env.aiEmbeddingModel).toBe('text-embedding-3-small');
    expect(env.aiEmbeddingDimensions).toBe(1536);
    expect(env.aiMatchingPolicy).toEqual({
      maxJobsPerRun: 20,
      minVectorScore: 0.6,
      minRuleScore: 60,
    });
  });

  it('loads explicit AI matching limits', () => {
    const env = loadEnv({
      ...base,
      AI_MATCH_MAX_JOBS_PER_RUN: '7',
      AI_MATCH_MIN_VECTOR_SCORE: '0.72',
      AI_MATCH_MIN_RULE_SCORE: '68',
    });

    expect(env.aiMatchingPolicy).toEqual({
      maxJobsPerRun: 7,
      minVectorScore: 0.72,
      minRuleScore: 68,
    });
  });

  it('rejects unsupported providers and invalid dimensions', () => {
    expect(() => loadEnv({ ...base, AI_PROVIDER: 'unknown' })).toThrow('Invalid environment configuration');
    expect(() => loadEnv({ ...base, AI_EMBEDDING_DIMENSIONS: '0' })).toThrow('Invalid environment configuration');
  });

  it('requires API credentials and a valid HTTPS base URL', () => {
    expect(() => loadEnv({ ...base, AI_API_KEY: '' })).toThrow('Invalid environment configuration');
    expect(() => loadEnv({ ...base, AI_BASE_URL: 'http://insecure.example' })).toThrow('Invalid environment configuration');
  });

  it('rejects AI matching limits outside their supported bounds', () => {
    expect(() => loadEnv({ ...base, AI_MATCH_MAX_JOBS_PER_RUN: '0' })).toThrow(
      'AI_MATCH_MAX_JOBS_PER_RUN'
    );
    expect(() => loadEnv({ ...base, AI_MATCH_MIN_VECTOR_SCORE: '1.1' })).toThrow(
      'AI_MATCH_MIN_VECTOR_SCORE'
    );
    expect(() => loadEnv({ ...base, AI_MATCH_MIN_RULE_SCORE: '-1' })).toThrow(
      'AI_MATCH_MIN_RULE_SCORE'
    );
  });
});
