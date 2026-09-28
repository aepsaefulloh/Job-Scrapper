import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { DEFAULT_SEARCH_PREFERENCES, type JobSearchPreferences } from '../../../src/search/preferences-types.js';
import { SearchPreferencesService } from '../../../src/search/search-preferences.service.js';

class InMemorySearchPreferencesRepository {
  private store = new Map<string, JobSearchPreferences>();

  public async get(candidateId: string): Promise<JobSearchPreferences | null> {
    return this.store.get(candidateId) ?? null;
  }

  public async save(
    candidateId: string,
    preferences: JobSearchPreferences
  ): Promise<JobSearchPreferences> {
    this.store.set(candidateId, { ...preferences });
    return { ...preferences };
  }
}

function createTestApp() {
  const repo = new InMemorySearchPreferencesRepository();
  const service = new SearchPreferencesService(repo as any);

  const app = createApp({
    profileDocumentMaxBytes: 1024,
    authenticate: async (token) => ({
      userId: token === 'token-b' ? 'candidate-b' : 'candidate-a',
      accessToken: token,
    }),
    createProfileService: () => ({ upload: async () => ({}) } as any),
    createSearchPreferencesService: () => service,
  } as any);

  return { app, service, repo };
}

describe('Search Preferences API Endpoints', () => {
  describe('GET /api/search-preferences', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).get('/api/search-preferences').expect(401);
    });

    it('returns default preferences for a new candidate', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .get('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual(DEFAULT_SEARCH_PREFERENCES);
      expect(res.body.maxPostingAgeDays).toBe(7);
      expect(res.body.sources).toEqual(['jobstreet', 'loker-id']);
      expect(res.body.unknownPostingDatePolicy).toBe('exclude');
    });

    it('returns candidate-scoped preferences', async () => {
      const { app, service } = createTestApp();
      await service.updatePreferences('candidate-a', {
        sources: ['loker-id'],
        locations: ['Bandung'],
        maxPostingAgeDays: 14,
      });

      const resA = await request(app)
        .get('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .expect(200);
      expect(resA.body.sources).toEqual(['loker-id']);
      expect(resA.body.locations).toEqual(['Bandung']);
      expect(resA.body.maxPostingAgeDays).toBe(14);

      // candidate-b still receives defaults
      const resB = await request(app)
        .get('/api/search-preferences')
        .set('Authorization', 'Bearer token-b')
        .expect(200);
      expect(resB.body).toEqual(DEFAULT_SEARCH_PREFERENCES);
    });
  });

  describe('PUT /api/search-preferences', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).put('/api/search-preferences').send({}).expect(401);
    });

    it('updates search preferences successfully', async () => {
      const { app } = createTestApp();
      const updatePayload = {
        sources: ['jobstreet', 'loker-id'],
        locations: ['Jakarta', 'Bogor'],
        workModes: ['remote', 'hybrid'],
        employmentTypes: ['full-time', 'contract'],
        maxPostingAgeDays: 14,
        unknownPostingDatePolicy: 'allow',
      };

      const res = await request(app)
        .put('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .send(updatePayload)
        .expect(200);

      expect(res.body.sources).toEqual(['jobstreet', 'loker-id']);
      expect(res.body.locations).toEqual(['Jakarta', 'Bogor']);
      expect(res.body.workModes).toEqual(['remote', 'hybrid']);
      expect(res.body.employmentTypes).toEqual(['full-time', 'contract']);
      expect(res.body.maxPostingAgeDays).toBe(14);
      expect(res.body.unknownPostingDatePolicy).toBe('allow');
    });

    it('normalizes locations on update', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .put('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .send({ locations: [' jakarta ', 'JAKARTA', 'surabaya'] })
        .expect(200);

      expect(res.body.locations).toEqual(['Jakarta', 'Surabaya']);
    });

    it('rejects unsupported job sources with 400', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .put('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .send({ sources: ['unsupported-source'] })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_PREFERENCES');
      expect(res.body.error.message).toContain('Unsupported job source: "unsupported-source"');
    });

    it('rejects invalid maxPostingAgeDays with 400', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .put('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .send({ maxPostingAgeDays: 0 })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_PREFERENCES');
      expect(res.body.error.message).toContain('maxPostingAgeDays must be a number between 1 and 90');
    });

    it('rejects unsupported unknownPostingDatePolicy with 400', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .put('/api/search-preferences')
        .set('Authorization', 'Bearer token-a')
        .send({ unknownPostingDatePolicy: 'invalid' })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_PREFERENCES');
      expect(res.body.error.message).toContain('Unsupported unknownPostingDatePolicy');
    });
  });
});
