import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app.js';

describe('GET /api/job-sources', () => {
  it('returns list of registered job sources with availability flags', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: 'u1', accessToken: 't1' }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn(),
    });

    const res = await request(app).get('/job-sources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const jobstreet = res.body.find((s: any) => s.id === 'jobstreet');
    const dealls = res.body.find((s: any) => s.id === 'dealls');

    expect(jobstreet).toBeDefined();
    expect(jobstreet.available).toBe(true);
    expect(dealls).toBeDefined();
    expect(dealls.available).toBe(false);
  });
});
