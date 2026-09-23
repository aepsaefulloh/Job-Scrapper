import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/config/env.js';
const base = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'key', AI_API_KEY: 'ai', AI_BASE_URL: 'https://ai.example/v1', AI_CHAT_MODEL: 'chat' };
describe('scheduler environment', () => {
  it('is disabled by default without scheduled credentials', () => { const env = loadEnv(base); expect(env.jobScrapeEnabled).toBe(false); expect(env.jobEmbeddingRecoveryEnabled).toBe(false); });
  it('loads bounded searches for an explicitly enabled scheduler', () => { const env = loadEnv({ ...base, JOB_SCRAPE_ENABLED: 'true', CAMOUFOX_EXECUTABLE_PATH: 'camoufox', JOB_SCRAPE_CANDIDATE_ID: 'candidate', JOB_SCRAPE_ACCESS_TOKEN: 'token', JOB_SCRAPE_SEARCHES_JSON: '[{"source":"jobstreet","keyword":"backend","maxPages":2}]' }); expect(env.scheduledJobSearches).toHaveLength(1); });
  it('allows empty searches when scheduler is enabled (candidate-driven discovery)', () => { const env = loadEnv({ ...base, JOB_SCRAPE_ENABLED: 'true', CAMOUFOX_EXECUTABLE_PATH: 'camoufox', JOB_SCRAPE_CANDIDATE_ID: 'candidate', JOB_SCRAPE_ACCESS_TOKEN: 'token', JOB_SCRAPE_SEARCHES_JSON: '[]' }); expect(env.scheduledJobSearches).toHaveLength(0); });
  it('rejects enabled scheduling without identity or searches', () => { expect(() => loadEnv({ ...base, JOB_SCRAPE_ENABLED: 'true' })).toThrow('JOB_SCRAPE_CANDIDATE_ID'); expect(() => loadEnv({ ...base, JOB_SCRAPE_SEARCHES_JSON: 'not-json' })).toThrow('JOB_SCRAPE_SEARCHES_JSON'); });
});
