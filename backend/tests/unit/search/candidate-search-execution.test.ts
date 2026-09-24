import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CandidateSearchService } from '../../../src/search/candidate-search.service.js';
import type { JobSearchIntent } from '../../../src/search/search-types.js';

describe('CandidateSearchService with SearchExecutionRepository', () => {
  let searchProfileService: any;
  let profileRepo: any;
  let searchPlanner: any;
  let scrapeRunRepo: any;
  let orchestrator: any;
  let searchPreferencesService: any;
  let searchExecutionRepo: any;

  beforeEach(() => {
    searchProfileService = {
      getOrDerive: vi.fn().mockResolvedValue({
        targetRoles: ['Frontend Engineer'],
        sources: ['jobstreet', 'loker-id'],
      }),
    };
    profileRepo = {
      getActiveProfile: vi.fn().mockResolvedValue({ id: 'p1', candidate_id: 'cand-1' }),
    };
    searchPlanner = {
      createIntents: vi.fn().mockReturnValue([
        { source: 'jobstreet', keyword: 'Frontend', maxPages: 1 },
        { source: 'loker-id', keyword: 'Frontend', maxPages: 1 },
      ] as JobSearchIntent[]),
    };
    scrapeRunRepo = {
      hasActiveRun: vi.fn().mockResolvedValue(false),
      start: vi.fn().mockImplementation(async ({ source }) => ({ id: `run-${source}` })),
      finish: vi.fn().mockResolvedValue(undefined),
    };
    orchestrator = {
      run: vi.fn().mockResolvedValue({
        discovered: 10,
        inserted: 5,
        updated: 1,
        duplicates: 4,
        failed: 0,
      }),
    };
    searchPreferencesService = {
      getPreferences: vi.fn().mockResolvedValue({
        sources: ['jobstreet', 'loker-id'],
        locations: ['Jakarta'],
        maxPostingAgeDays: 7,
      }),
    };
    searchExecutionRepo = {
      create: vi.fn().mockResolvedValue({
        id: 'exec-123',
        status: 'running',
      }),
      updateStage: vi.fn().mockResolvedValue(undefined),
      appendTimeline: vi.fn().mockResolvedValue(undefined),
      finish: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('creates parent search execution and returns its id upon runManualSearch', async () => {
    const service = new CandidateSearchService(
      searchProfileService,
      profileRepo,
      searchPlanner,
      scrapeRunRepo,
      orchestrator,
      undefined,
      searchPreferencesService,
      searchExecutionRepo
    );

    const result = await service.runManualSearch('cand-1', { maxPages: 1 });

    expect(result.id).toBe('exec-123');
    expect(result.status).toBe('running');
    expect(result.runIds).toHaveLength(2);
    expect(searchExecutionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand-1',
        trigger: 'manual',
      })
    );
  });

  it('marks execution as partial if one source fails and completes background execution', async () => {
    orchestrator.run
      .mockResolvedValueOnce({
        discovered: 10,
        inserted: 5,
        updated: 0,
        duplicates: 5,
        failed: 0,
      })
      .mockRejectedValueOnce(new Error('Loker.id blocked'));

    const service = new CandidateSearchService(
      searchProfileService,
      profileRepo,
      searchPlanner,
      scrapeRunRepo,
      orchestrator,
      undefined,
      searchPreferencesService,
      searchExecutionRepo
    );

    await service.runManualSearch('cand-1');

    // Allow background promises to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(searchExecutionRepo.finish).toHaveBeenCalledWith(
      'cand-1',
      'exec-123',
      expect.objectContaining({
        status: 'partial',
      })
    );
  });

  it('supports all 4 sources (jobstreet, loker-id, dealls, glints) and tracks partial failure', async () => {
    searchPlanner.createIntents = vi.fn().mockReturnValue([
      { source: 'jobstreet', keyword: 'Software', maxPages: 1 },
      { source: 'loker-id', keyword: 'Software', maxPages: 1 },
      { source: 'dealls', keyword: 'Software', maxPages: 1 },
      { source: 'glints', keyword: 'Software', maxPages: 1 },
    ]);

    // 3 sources succeed, 1 (glints) fails
    orchestrator.run
      .mockResolvedValueOnce({ discovered: 5, inserted: 2, updated: 0, duplicates: 3, failed: 0 })
      .mockResolvedValueOnce({ discovered: 4, inserted: 1, updated: 0, duplicates: 3, failed: 0 })
      .mockResolvedValueOnce({ discovered: 6, inserted: 3, updated: 0, duplicates: 3, failed: 0 })
      .mockRejectedValueOnce(new Error('Glints connection timeout'));

    const service = new CandidateSearchService(
      searchProfileService,
      profileRepo,
      searchPlanner,
      scrapeRunRepo,
      orchestrator,
      undefined,
      searchPreferencesService,
      searchExecutionRepo
    );

    const result = await service.runManualSearch('cand-1', { maxIntents: 4 });
    expect(result.runIds).toHaveLength(4);

    // Allow background promises to resolve
    await new Promise((r) => setTimeout(r, 80));

    expect(searchExecutionRepo.finish).toHaveBeenCalledWith(
      'cand-1',
      'exec-123',
      expect.objectContaining({
        status: 'partial',
        summary: expect.objectContaining({
          discovered: 15,
          inserted: 6,
        }),
      })
    );
  });
});
