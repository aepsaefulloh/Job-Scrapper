import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import {
  SearchAlreadyRunningError,
  SearchProfileNotReadyError,
} from '../../../src/search/candidate-search.service.js';

function createTestApp(overrides: Record<string, unknown> = {}) {
  const mockCandidateSearchService = {
    runManualSearch: vi.fn().mockResolvedValue({
      status: 'running',
      runIds: ['run-1', 'run-2'],
    }),
  };

  const sampleRun = {
    id: 'run-1',
    candidateId: 'candidate-a',
    source: 'jobstreet',
    keyword: 'frontend',
    location: 'Jakarta',
    status: 'completed',
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T00:01:00Z',
    discovered: 10,
    inserted: 7,
    updated: 1,
    duplicates: 2,
    failed: 0,
    safeErrorCode: null,
    safeErrorMessage: null,
    trigger: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockScrapeRunService = {
    list: vi.fn().mockResolvedValue([sampleRun]),
    getLatest: vi.fn().mockResolvedValue(sampleRun),
    getById: vi.fn().mockImplementation(async (candidateId, runId) => {
      if (runId === 'run-1') return sampleRun;
      return null;
    }),
  };

  const app = createApp({
    profileDocumentMaxBytes: 1024,
    authenticate: async (token) => ({
      userId: token === 'token-a' ? 'candidate-a' : 'candidate-b',
      accessToken: token,
    }),
    createProfileService: () => ({ upload: async () => ({}) } as any),
    createCandidateSearchService: () => mockCandidateSearchService as any,
    createScrapeRunService: () => mockScrapeRunService as any,
    ...overrides,
  } as any);

  return { app, mockCandidateSearchService, mockScrapeRunService, sampleRun };
}

describe('Candidate Search Control & Scrape Run API', () => {
  describe('POST /search/run', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).post('/search/run').expect(401);
    });

    it('triggers candidate search and returns 202 with running status and runIds', async () => {
      const { app, mockCandidateSearchService } = createTestApp();
      const res = await request(app)
        .post('/search/run')
        .set('Authorization', 'Bearer token-a')
        .send({ maxPages: 2 })
        .expect(202);

      expect(res.body).toEqual({
        status: 'running',
        runIds: ['run-1', 'run-2'],
      });
      expect(mockCandidateSearchService.runManualSearch).toHaveBeenCalledWith('candidate-a', { maxPages: 2 });
    });

    it('returns 400 when search profile is not ready', async () => {
      const { app, mockCandidateSearchService } = createTestApp();
      mockCandidateSearchService.runManualSearch.mockRejectedValueOnce(new SearchProfileNotReadyError());

      const res = await request(app)
        .post('/search/run')
        .set('Authorization', 'Bearer token-a')
        .expect(400);

      expect(res.body.error).toEqual({
        code: 'SEARCH_PROFILE_NOT_READY',
        message: 'Your job search profile is not ready yet. Complete or update your candidate profile first.',
      });
    });

    it('returns 409 when a search is already running', async () => {
      const { app, mockCandidateSearchService } = createTestApp();
      mockCandidateSearchService.runManualSearch.mockRejectedValueOnce(new SearchAlreadyRunningError());

      const res = await request(app)
        .post('/search/run')
        .set('Authorization', 'Bearer token-a')
        .expect(409);

      expect(res.body.error).toEqual({
        code: 'SEARCH_ALREADY_RUNNING',
        message: 'A search is already running for this profile.',
      });
    });
  });

  describe('GET /scrape-runs', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).get('/scrape-runs').expect(401);
    });

    it('returns list of scrape runs for authenticated candidate', async () => {
      const { app, mockScrapeRunService, sampleRun } = createTestApp();
      const res = await request(app)
        .get('/scrape-runs?limit=5')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual({ items: [sampleRun] });
      expect(mockScrapeRunService.list).toHaveBeenCalledWith('candidate-a', 5);
    });
  });

  describe('GET /scrape-runs/latest', () => {
    it('returns latest scrape run', async () => {
      const { app, mockScrapeRunService, sampleRun } = createTestApp();
      const res = await request(app)
        .get('/scrape-runs/latest')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual({ latest: sampleRun });
      expect(mockScrapeRunService.getLatest).toHaveBeenCalledWith('candidate-a');
    });

    it('returns null latest when no runs exist', async () => {
      const { app, mockScrapeRunService } = createTestApp();
      mockScrapeRunService.getLatest.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/scrape-runs/latest')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual({ latest: null });
    });
  });

  describe('GET /scrape-runs/:id', () => {
    it('returns scrape run detail when found', async () => {
      const { app, sampleRun } = createTestApp();
      const res = await request(app)
        .get('/scrape-runs/run-1')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual(sampleRun);
    });

    it('returns 404 when scrape run is not found', async () => {
      const { app } = createTestApp();
      await request(app)
        .get('/scrape-runs/nonexistent')
        .set('Authorization', 'Bearer token-a')
        .expect(404);
    });
  });
});
