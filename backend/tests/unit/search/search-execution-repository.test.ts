import { describe, expect, it, vi } from 'vitest';
import { SupabaseSearchExecutionRepository } from '../../../src/search/search-execution.repository.js';

describe('SupabaseSearchExecutionRepository', () => {
  it('creates a new search execution record', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseSearchExecutionRepository(fakeClient);

    const mockRow = {
      id: 'exec-1',
      candidate_id: 'cand-1',
      status: 'running',
      trigger: 'manual',
      started_at: '2026-09-24T10:00:00.000Z',
      finished_at: null,
      preferences_snapshot: { sources: ['jobstreet'] },
      intents_snapshot: [{ source: 'jobstreet', keyword: 'Developer' }],
      stages: [{ id: 'init', name: 'Initialized', status: 'completed' }],
      timeline: [{ timestamp: '2026-09-24T10:00:00.000Z', message: 'Search started' }],
      summary: { discovered: 0, inserted: 0, updated: 0, duplicates: 0, failed: 0, filteredOut: 0, aiEvaluated: 0, aiFailed: 0 },
      error_code: null,
      error_message: null,
      created_at: '2026-09-24T10:00:00.000Z',
    };

    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({ data: mockRow, error: null }),
        }),
      }),
    });

    const result = await repo.create({
      candidateId: 'cand-1',
      trigger: 'manual',
      preferencesSnapshot: { sources: ['jobstreet'] },
      intentsSnapshot: [{ source: 'jobstreet', keyword: 'Developer' }],
      initialStages: [{ id: 'init', name: 'Initialized', status: 'completed' }],
    });

    expect(result.id).toBe('exec-1');
    expect(result.status).toBe('running');
    expect(result.intentsSnapshot).toHaveLength(1);
  });

  it('retrieves execution by id with child sources from scrape_runs', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseSearchExecutionRepository(fakeClient);

    const mockExec = {
      id: 'exec-1',
      candidate_id: 'cand-1',
      status: 'running',
      trigger: 'manual',
      started_at: '2026-09-24T10:00:00.000Z',
      finished_at: null,
      preferences_snapshot: {},
      intents_snapshot: [],
      stages: [],
      timeline: [],
      summary: { discovered: 10, inserted: 5, updated: 0, duplicates: 5, failed: 0, filteredOut: 0, aiEvaluated: 0, aiFailed: 0 },
      error_code: null,
      error_message: null,
      created_at: '2026-09-24T10:00:00.000Z',
    };

    const mockScrapeRuns = [
      {
        id: 'run-1',
        source: 'jobstreet',
        status: 'completed',
        discovered_count: 10,
        inserted_count: 5,
        duplicate_count: 5,
        failed_count: 0,
        started_at: '2026-09-24T10:00:00.000Z',
        finished_at: '2026-09-24T10:00:30.000Z',
        error_message: null,
      },
    ];

    // Query search_executions
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({ data: mockExec, error: null }),
          }),
        }),
      }),
    });

    // Query scrape_runs
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({ data: mockScrapeRuns, error: null }),
          }),
        }),
      }),
    });

    const execution = await repo.getById('cand-1', 'exec-1');
    expect(execution).not.toBeNull();
    expect(execution?.id).toBe('exec-1');
    expect(execution?.sources).toHaveLength(1);
    expect(execution?.sources?.[0]).toEqual({
      source: 'jobstreet',
      status: 'completed',
      discovered: 10,
      inserted: 5,
      duplicates: 5,
      failed: 0,
      durationMs: 30000,
      error: null,
    });
  });

  it('updates stage, appends timeline, and finishes execution', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseSearchExecutionRepository(fakeClient);

    // Mock getById for updateStage
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'exec-1',
                stages: [{ id: 'scrape', name: 'Scraping', status: 'pending' }],
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock update for updateStage
    fromMock.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      }),
    });

    await repo.updateStage('cand-1', 'exec-1', 'scrape', 'completed', '20 jobs found');

    // Mock getById for appendTimeline
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'exec-1',
                timeline: [],
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock update for appendTimeline
    fromMock.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      }),
    });

    await repo.appendTimeline('cand-1', 'exec-1', {
      message: 'Jobstreet completed',
      type: 'success',
    });

    // Mock finish
    fromMock.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      }),
    });

    await repo.finish('cand-1', 'exec-1', {
      status: 'completed',
      summary: {
        discovered: 20,
        inserted: 15,
        updated: 0,
        duplicates: 5,
        failed: 0,
        filteredOut: 2,
        aiEvaluated: 15,
        aiFailed: 0,
      },
    });

    expect(fromMock).toHaveBeenCalledTimes(5);
  });

  it('lists search executions with pagination and filters', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseSearchExecutionRepository(fakeClient);

    const mockRow = {
      id: 'exec-1',
      candidate_id: 'cand-1',
      status: 'completed',
      trigger: 'manual',
      started_at: '2026-09-24T10:00:00.000Z',
      finished_at: '2026-09-24T10:01:00.000Z',
      preferences_snapshot: { sources: ['jobstreet'] },
      intents_snapshot: [],
      stages: [],
      timeline: [],
      summary: { discovered: 10, inserted: 5, updated: 0, duplicates: 5, failed: 0, filteredOut: 0, aiEvaluated: 5, aiFailed: 0 },
      error_code: null,
      error_message: null,
      created_at: '2026-09-24T10:00:00.000Z',
    };

    const mockScrapeRun = {
      id: 'run-1',
      search_execution_id: 'exec-1',
      candidate_id: 'cand-1',
      source: 'jobstreet',
      status: 'completed',
      discovered_count: 10,
      inserted_count: 5,
      duplicate_count: 5,
      failed_count: 0,
      started_at: '2026-09-24T10:00:00.000Z',
      finished_at: '2026-09-24T10:00:45.000Z',
      error_message: null,
    };

    const queryMock: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({
        data: [mockRow],
        count: 1,
        error: null,
      }),
    };

    const scrapeRunsQueryMock: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({
        data: [mockScrapeRun],
        error: null,
      }),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'search_executions') return queryMock;
      if (table === 'scrape_runs') return scrapeRunsQueryMock;
      return {};
    });

    const result = await repo.list('cand-1', {
      limit: 10,
      offset: 0,
      status: 'completed',
      trigger: 'manual',
      from: '2026-09-24T00:00:00.000Z',
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('exec-1');
    expect(result.items[0].sources).toHaveLength(1);
    expect(result.items[0].sources![0].source).toBe('jobstreet');
    expect(result.items[0].sources![0].durationMs).toBe(45000);

    expect(queryMock.eq).toHaveBeenCalledWith('candidate_id', 'cand-1');
    expect(queryMock.eq).toHaveBeenCalledWith('status', 'completed');
    expect(queryMock.eq).toHaveBeenCalledWith('trigger', 'manual');
    expect(queryMock.gte).toHaveBeenCalledWith('created_at', '2026-09-24T00:00:00.000Z');
    expect(queryMock.range).toHaveBeenCalledWith(0, 9);
  });
});

