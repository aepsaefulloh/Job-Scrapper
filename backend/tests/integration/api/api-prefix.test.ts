import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app.js';

describe('API router prefixing (/api and root)', () => {
  it('serves job routes on both /api/jobs and /jobs', async () => {
    const app = createApp({
      createProfileService: () => ({ upload: async () => ({ documentId: '', profileId: '', checksum: '', uploadedAt: '', skillCount: 0 }) }),
      createJobService: () => ({
        list: async () => ({ items: [], total: 0 }),
        detail: async () => null,
        update: async () => null,
      } as any),
      authenticate: async (accessToken) => ({ userId: 'candidate-1', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    const resPrefix = await request(app).get('/api/jobs').set('Authorization', 'Bearer token');
    expect(resPrefix.status).toBe(200);

    const resRoot = await request(app).get('/jobs').set('Authorization', 'Bearer token');
    expect(resRoot.status).toBe(200);
  });
});
