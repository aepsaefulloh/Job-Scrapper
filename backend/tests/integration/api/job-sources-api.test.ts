import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app.js';

describe('GET /api/job-sources', () => {
  it('returns list of registered job sources with availability flags and capabilities', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: 'u1', accessToken: 't1' }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn(),
    });

    const res = await request(app).get('/job-sources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const jobstreet = res.body.find((s: any) => s.id === 'jobstreet');
    const lokerId = res.body.find((s: any) => s.id === 'loker-id');
    const dealls = res.body.find((s: any) => s.id === 'dealls');
    const glints = res.body.find((s: any) => s.id === 'glints');
    const indeed = res.body.find((s: any) => s.id === 'indeed');

    expect(jobstreet?.available).toBe(true);
    expect(lokerId?.available).toBe(true);
    expect(dealls?.available).toBe(true);
    expect(dealls?.supportsLocation).toBe(true);
    expect(dealls?.supportsFreshness).toBe(true);
    expect(dealls?.supportsWorkMode).toBe(true);

    expect(glints?.available).toBe(true);
    expect(glints?.supportsLocation).toBe(true);
    expect(glints?.supportsFreshness).toBe(true);
    expect(glints?.supportsWorkMode).toBe(true);

    expect(indeed?.available).toBe(false);
  });
});
