import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

describe('matching API', () => {
  const app = createApp({
    profileDocumentMaxBytes: 1_048_576,
    authenticate: async (token) => ({ userId: token === 'token' ? 'candidate' : 'other', accessToken: token }),
    createProfileService: () => ({ upload: async () => ({ documentId: 'd', profileId: 'p', checksum: 'c', uploadedAt: 't', skillCount: 0 }) }),
    matchingService: { recommend: async () => [{ jobId: 'job-1', similarity: 0.9, ruleScore: 80, breakdown: { skills: 40, experience: 20, role: 10, preference: 10 }, aiAnalysis: { status: 'failed', ruleScore: 80, error: 'AI evaluation failed.' }, recommendation: 'fallback' }] },
  });

  it('requires authentication', async () => {
    await request(app).get('/matching/jobs/candidate').expect(401);
  });

  it('rejects a candidate ID that differs from the authenticated user', async () => {
    await request(app).get('/matching/jobs/other').set('Authorization', 'Bearer token').expect(403);
  });

  it('returns ranked recommendations and preserves partial AI failure', async () => {
    const response = await request(app).get('/matching/jobs/candidate?limit=10&threshold=0.5').set('Authorization', 'Bearer token').expect(200);
    expect(response.body[0]).toMatchObject({ job_id: 'job-1', similarity: 0.9, rule_score: 80, ai_analysis: { status: 'failed' } });
  });
});
