import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

describe('job API', () => {
  it('requires auth and triggers a candidate-owned manual scrape', async () => {
    const scrape = async () => ({ source: 'jobstreet', discovered: 1, inserted: 1, updated: 0, duplicates: 0, failed: 0 });
    const app = createApp({ profileDocumentMaxBytes: 1_048_576, authenticate: async () => ({ userId: 'candidate', accessToken: 'token' }), createProfileService: () => ({ upload: async () => ({ documentId: 'd', profileId: 'p', checksum: 'c', uploadedAt: 't', skillCount: 0 }) }), jobService: { scrape } });
    await request(app).post('/jobs/scrape').expect(401);
    const response = await request(app).post('/jobs/scrape').set('Authorization', 'Bearer token').send({ source: 'jobstreet', keyword: 'backend engineer', location: 'Indonesia' }).expect(202);
    expect(response.body).toMatchObject({ source: 'jobstreet', discovered: 1, inserted: 1 });
  });
});
