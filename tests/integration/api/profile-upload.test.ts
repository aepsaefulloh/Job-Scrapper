import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app.js';

const validMarkdown = '# Name\n\nAda Lovelace\n\n## Skills\n\n- TypeScript';

describe('POST /v1/profile/document', () => {
  it('creates a revision from a Markdown upload', async () => {
    const app = createApp({
      createProfileService: () => ({ upload: async () => ({
        documentId: 'document-id', profileId: 'profile-id', checksum: 'a'.repeat(64),
        uploadedAt: '2026-09-22T00:00:00.000Z', skillCount: 1
      }) }),
      authenticate: async (accessToken) => ({ userId: 'candidate-id', accessToken }),
      profileDocumentMaxBytes: 1024
    });

    const response = await request(app)
      .post('/v1/profile/document')
      .set('Authorization', 'Bearer test-token')
      .attach('document', Buffer.from(validMarkdown), { filename: 'candidate.md', contentType: 'text/plain' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ profileId: 'profile-id', skillCount: 1 });
  });

  it('returns 400 for a non-Markdown filename', async () => {
    const app = createApp({
      createProfileService: () => ({ upload: async () => { throw new Error('must not run'); } }),
      authenticate: async (accessToken) => ({ userId: 'candidate-id', accessToken }),
      profileDocumentMaxBytes: 1024
    });

    const response = await request(app)
      .post('/v1/profile/document')
      .set('Authorization', 'Bearer test-token')
      .attach('document', Buffer.from(validMarkdown), { filename: 'candidate.txt' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_UPLOAD');
  });
});
