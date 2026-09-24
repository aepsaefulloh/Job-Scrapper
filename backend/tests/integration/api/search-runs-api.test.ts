import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import type { SearchExecutionRecord } from '../../../src/search/search-execution.repository.js';

function createTestApp(overrides: Record<string, unknown> = {}) {
  const sampleExecution: SearchExecutionRecord = {
    id: 'exec-123',
    candidateId: 'candidate-a',
    status: 'running',
    trigger: 'manual',
    startedAt: '2026-09-24T12:00:00Z',
    finishedAt: null,
    preferencesSnapshot: { sources: ['jobstreet', 'loker_id'] },
    intentsSnapshot: [{ source: 'jobstreet', keyword: 'Software Engineer', location: 'Jakarta' }],
    stages: [
      { id: 'query_expansion', name: 'Query Expansion & Aliasing', status: 'completed' },
      { id: 'scraping', name: 'Scraping Sources', status: 'running' },
    ],
    timeline: [
      { timestamp: '2026-09-24T12:00:00Z', message: 'Search execution started', type: 'info' },
    ],
    summary: {
      discovered: 10,
      inserted: 5,
      updated: 2,
      duplicates: 3,
      failed: 0,
      filteredOut: 0,
      aiEvaluated: 0,
      aiFailed: 0,
    },
    sources: [
      {
        source: 'jobstreet',
        status: 'completed',
        discovered: 10,
        inserted: 5,
        duplicates: 3,
        failed: 0,
        durationMs: 45000,
      },
    ],
    createdAt: '2026-09-24T12:00:00Z',
  };

  const mockSearchExecutionRepo = {
    getById: vi.fn().mockImplementation(async (candidateId, id) => {
      if (candidateId === 'candidate-a' && id === 'exec-123') {
        return sampleExecution;
      }
      return null;
    }),
    list: vi.fn().mockImplementation(async (candidateId, options) => {
      if (candidateId === 'candidate-a') {
        return { items: [sampleExecution], total: 1 };
      }
      return { items: [], total: 0 };
    }),
    create: vi.fn(),
    updateStage: vi.fn(),
    appendTimeline: vi.fn(),
    finish: vi.fn(),
  };

  const mockCandidateSearchService = {
    runManualSearch: vi.fn().mockResolvedValue({
      id: 'exec-123',
      status: 'running',
      runIds: [],
      totalIntents: 2,
      sources: ['jobstreet', 'loker_id'],
      message: 'Search started',
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
    createSearchExecutionRepo: () => mockSearchExecutionRepo as any,
    ...overrides,
  } as any);

  return { app, mockSearchExecutionRepo, mockCandidateSearchService, sampleExecution };
}

describe('Search Runs API (Execution Parent)', () => {
  describe('GET /api/search-runs/:id', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).get('/api/search-runs/exec-123').expect(401);
    });

    it('returns 404 when search execution is not found', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .get('/api/search-runs/exec-not-found')
        .set('Authorization', 'Bearer token-a')
        .expect(404);

      expect(res.body.error).toEqual({
        code: 'SEARCH_EXECUTION_NOT_FOUND',
        message: 'Search execution was not found.',
      });
    });

    it('returns execution details with sources, stages, and timeline', async () => {
      const { app, mockSearchExecutionRepo, sampleExecution } = createTestApp();
      const res = await request(app)
        .get('/api/search-runs/exec-123')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual(sampleExecution);
      expect(mockSearchExecutionRepo.getById).toHaveBeenCalledWith('candidate-a', 'exec-123');
    });

    it('enforces candidate isolation (cannot access another candidate execution)', async () => {
      const { app, mockSearchExecutionRepo } = createTestApp();
      await request(app)
        .get('/api/search-runs/exec-123')
        .set('Authorization', 'Bearer token-b')
        .expect(404);

      expect(mockSearchExecutionRepo.getById).toHaveBeenCalledWith('candidate-b', 'exec-123');
    });
  });

  describe('GET /api/search-runs', () => {
    it('requires authentication', async () => {
      const { app } = createTestApp();
      await request(app).get('/api/search-runs').expect(401);
    });

    it('returns list of executions with pagination for authenticated user', async () => {
      const { app, mockSearchExecutionRepo, sampleExecution } = createTestApp();
      const res = await request(app)
        .get('/api/search-runs?limit=5&offset=0')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(res.body).toEqual({
        items: [sampleExecution],
        pagination: { limit: 5, offset: 0, total: 1 },
      });
      expect(mockSearchExecutionRepo.list).toHaveBeenCalledWith('candidate-a', {
        limit: 5,
        offset: 0,
        status: undefined,
        source: undefined,
        trigger: undefined,
        from: undefined,
        to: undefined,
      });
    });

    it('passes filter parameters to the repository', async () => {
      const { app, mockSearchExecutionRepo } = createTestApp();
      await request(app)
        .get('/api/search-runs?limit=10&offset=5&status=completed&source=jobstreet&trigger=manual&from=2026-09-01T00:00:00Z&to=2026-09-24T00:00:00Z')
        .set('Authorization', 'Bearer token-a')
        .expect(200);

      expect(mockSearchExecutionRepo.list).toHaveBeenCalledWith('candidate-a', {
        limit: 10,
        offset: 5,
        status: 'completed',
        source: 'jobstreet',
        trigger: 'manual',
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-24T00:00:00Z',
      });
    });
  });

  describe('POST /api/search/run returns parent execution ID', () => {
    it('returns execution id in 202 response', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .post('/api/search/run')
        .set('Authorization', 'Bearer token-a')
        .expect(202);

      expect(res.body.id).toBe('exec-123');
      expect(res.body.status).toBe('running');
    });
  });
});
