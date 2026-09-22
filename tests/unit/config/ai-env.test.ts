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
  });

  it('rejects unsupported providers and invalid dimensions', () => {
    expect(() => loadEnv({ ...base, AI_PROVIDER: 'unknown' })).toThrow('Invalid environment configuration');
    expect(() => loadEnv({ ...base, AI_EMBEDDING_DIMENSIONS: '0' })).toThrow('Invalid environment configuration');
  });

  it('requires API credentials and a valid HTTPS base URL', () => {
    expect(() => loadEnv({ ...base, AI_API_KEY: '' })).toThrow('Invalid environment configuration');
    expect(() => loadEnv({ ...base, AI_BASE_URL: 'http://insecure.example' })).toThrow('Invalid environment configuration');
  });
});
