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
    const linkedin = res.body.find((s: any) => s.id === 'linkedin');
    const kitalulus = res.body.find((s: any) => s.id === 'kitalulus');
    const kalibrr = res.body.find((s: any) => s.id === 'kalibrr');
    const karir = res.body.find((s: any) => s.id === 'karir');

    expect(jobstreet?.available).toBe(true);
    expect(lokerId?.available).toBe(true);
    expect(dealls?.available).toBe(true);
    expect(glints?.available).toBe(true);
    expect(indeed?.available).toBe(true);
    expect(linkedin?.available).toBe(true);
    expect(kitalulus?.available).toBe(true);
    expect(kalibrr?.available).toBe(true);
    expect(karir?.available).toBe(true);
  });
});
