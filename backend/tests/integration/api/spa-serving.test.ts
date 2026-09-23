import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app.js';

describe('Express SPA serving', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'spa-test-'));
    await writeFile(path.join(tempDir, 'index.html'), '<!DOCTYPE html><html><body><div id="app">JobToolkit SPA</div></body></html>');
    await writeFile(path.join(tempDir, 'test.css'), 'body { background: #fbfbf9; }');
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('serves index.html on root / and fallback for client routes like /jobs', async () => {
    const app = createApp({
      staticDir: tempDir,
      createProfileService: () => ({ upload: async () => ({ documentId: '', profileId: '', checksum: '', uploadedAt: '', skillCount: 0 }) }),
      createJobService: () => ({
        list: async () => ({ items: [], total: 0 }),
        detail: async () => null,
        update: async () => null,
      } as any),
      authenticate: async (accessToken) => ({ userId: 'candidate-1', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    const rootRes = await request(app).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.text).toContain('JobToolkit SPA');

    const jobsRes = await request(app).get('/jobs');
    expect(jobsRes.status).toBe(200);
    expect(jobsRes.text).toContain('JobToolkit SPA');

    const staticRes = await request(app).get('/test.css');
    expect(staticRes.status).toBe(200);
    expect(staticRes.text).toContain('#fbfbf9');
  });

  it('does not serve index.html for /api routes', async () => {
    const app = createApp({
      staticDir: tempDir,
      createProfileService: () => ({ upload: async () => ({ documentId: '', profileId: '', checksum: '', uploadedAt: '', skillCount: 0 }) }),
      createJobService: () => ({
        list: async () => ({ items: [], total: 0 }),
        detail: async () => null,
        update: async () => null,
      } as any),
      authenticate: async (accessToken) => ({ userId: 'candidate-1', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    // /api/jobs without auth returns 401 JSON, not the HTML fallback
    const apiRes = await request(app).get('/api/jobs');
    expect(apiRes.status).toBe(401);
    expect(apiRes.body.error?.code).toBe('UNAUTHENTICATED');
    expect(apiRes.text).not.toContain('JobToolkit SPA');
  });
});
