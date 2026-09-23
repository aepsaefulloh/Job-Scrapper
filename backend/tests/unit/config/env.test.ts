import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/config/env.js';

describe('loadEnv', () => {
  it('rejects a missing Supabase URL', () => {
    expect(() => loadEnv({ PORT: '3000' })).toThrow('SUPABASE_URL');
  });

  it('returns validated configuration', () => {
    expect(loadEnv({
      PORT: '3000',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      PROFILE_DOCUMENT_MAX_BYTES: '1048576',
      AI_API_KEY: 'secret',
      AI_BASE_URL: 'https://api.example/v1',
      AI_CHAT_MODEL: 'chat-model'
    })).toMatchObject({ port: 3000, profileDocumentMaxBytes: 1048576 });
  });
});
