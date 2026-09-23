import { describe, expect, it } from 'vitest';
import { retryTransient } from '../../../src/scraping/retry.js';

describe('retryTransient', () => {
  it('retries a transient navigation failure with bounded attempts', async () => {
    let attempts = 0;
    await expect(retryTransient(async () => { attempts += 1; if (attempts < 3) throw Object.assign(new Error('timeout'), { code: 'NAVIGATION_TIMEOUT' }); return 'ok'; }, { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 })).resolves.toBe('ok');
    expect(attempts).toBe(3);
  });
});
