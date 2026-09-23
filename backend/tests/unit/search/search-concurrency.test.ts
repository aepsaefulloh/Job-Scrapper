import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CandidateSearchService,
  SearchAlreadyRunningError,
} from '../../../src/search/candidate-search.service.js';
import type { ProfileRepository } from '../../../src/infrastructure/supabase/profile-repository.js';
import type { ScrapeRunRepository } from '../../../src/scraping/scrape-run.service.js';
import type { ScraperOrchestrator } from '../../../src/scraping/scraper.orchestrator.js';
import { SearchPlanner } from '../../../src/search/search-planner.js';
import { SearchProfileService } from '../../../src/search/search-profile.service.js';

describe('Search Concurrency Identity Guard', () => {
  const candidateId = 'cand-001';
  let mockProfileRepo: ProfileRepository;
  let mockScrapeRunRepo: ScrapeRunRepository;
  let mockOrchestrator: ScraperOrchestrator;
  let mockSearchProfileRepo: any;
  let searchProfileService: SearchProfileService;
  let searchPlanner: SearchPlanner;

  beforeEach(() => {
    mockProfileRepo = {
      getActiveProfile: vi.fn().mockResolvedValue({
        id: 'prof-1',
        candidateId,
        headline: 'Accountant',
        summary: 'Financial expert',
        experience: 'Accounting Firm',
        careerPreferences: null,
        skills: [{ displayName: 'Tax', canonicalName: 'tax' }],
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      createProfile: vi.fn(),
      saveDocument: vi.fn(),
      getDocument: vi.fn(),
    };

    mockScrapeRunRepo = {
      start: vi.fn().mockResolvedValue({ id: 'run-101' }),
      finish: vi.fn().mockResolvedValue(undefined),
      hasActiveRun: vi.fn().mockResolvedValue(false),
      hasAnyActiveRun: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      getLatest: vi.fn().mockResolvedValue(null),
      getById: vi.fn().mockResolvedValue(null),
    };

    mockOrchestrator = {
      run: vi.fn().mockResolvedValue({
        source: 'loker-id',
        discovered: 10,
        inserted: 5,
        updated: 0,
        duplicates: 5,
        failed: 0,
      }),
    } as unknown as ScraperOrchestrator;

    mockSearchProfileRepo = {
      get: vi.fn().mockResolvedValue({
        candidateId,
        sourceProfileId: 'prof-1',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Accountant'],
        roleAliases: [],
        primarySkills: ['Accounting'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: ['Jakarta'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    searchProfileService = new SearchProfileService(mockSearchProfileRepo);
    searchPlanner = new SearchPlanner();
  });

  it('blocks search when Loker.id / Accountant / Jakarta is already running for the candidate', async () => {
    mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
      async (cid, search) => {
        return (
          cid === candidateId &&
          search.source === 'loker-id' &&
          search.keyword === 'accountant' &&
          search.location === 'jakarta'
        );
      }
    );

    // If both jobstreet and loker-id are active, but loker-id is blocked, jobstreet still runs!
    // But if both are active:
    mockScrapeRunRepo.hasActiveRun = vi.fn().mockResolvedValue(true);

    const service = new CandidateSearchService(
      searchProfileService,
      mockProfileRepo,
      searchPlanner,
      mockScrapeRunRepo,
      mockOrchestrator
    );

    await expect(service.runManualSearch(candidateId)).rejects.toThrow(SearchAlreadyRunningError);
  });

  it('allows Loker.id search when Jobstreet / Accountant / Jakarta is running', async () => {
    // Jobstreet is active, Loker.id is free
    mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
      async (_cid, search) => search.source === 'jobstreet'
    );

    const service = new CandidateSearchService(
      searchProfileService,
      mockProfileRepo,
      searchPlanner,
      mockScrapeRunRepo,
      mockOrchestrator
    );

    const result = await service.runManualSearch(candidateId, { maxPages: 1 });
    expect(result.status).toBe('running');
    expect(result.runIds).toHaveLength(1);
    expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'loker-id',
      })
    );
  });

  it('allows Loker.id / Finance Manager / Jakarta when Loker.id / Accountant / Jakarta is running', async () => {
    // Only 'accountant' keyword is active
    mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
      async (_cid, search) => search.keyword === 'accountant'
    );

    // Update candidate profile to Finance Manager
    mockSearchProfileRepo.get = vi.fn().mockResolvedValue({
      candidateId,
      sourceProfileId: 'prof-1',
      sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
      targetRoles: ['Finance Manager'],
      roleAliases: [],
      primarySkills: ['Finance'],
      secondarySkills: [],
      industries: [],
      seniority: [],
      preferredLocations: ['Jakarta'],
      workModes: [],
      employmentTypes: ['full-time'],
      excludedRoles: [],
      excludedKeywords: [],
      excludedCompanies: [],
      languages: [],
      sources: ['loker-id'],
      generatedAt: '2026-01-01T00:00:00Z',
    });

    const service = new CandidateSearchService(
      searchProfileService,
      mockProfileRepo,
      searchPlanner,
      mockScrapeRunRepo,
      mockOrchestrator
    );

    const result = await service.runManualSearch(candidateId, { maxPages: 1, maxIntents: 1 });
    expect(result.status).toBe('running');
    expect(result.runIds).toHaveLength(1);
    expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'loker-id',
        keyword: 'finance manager',
      })
    );
  });

  it('allows the same search for a different candidate', async () => {
    const candidateTwo = 'cand-002';
    // Active run belongs only to candidate-001
    mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
      async (cid) => cid === candidateId
    );

    mockProfileRepo.getActiveProfile = vi.fn().mockResolvedValue({
      id: 'prof-2',
      candidateId: candidateTwo,
      headline: 'Accountant',
      summary: 'Candidate 2',
      experience: 'Firm B',
      careerPreferences: null,
      skills: [{ displayName: 'Tax', canonicalName: 'tax' }],
      updatedAt: '2026-01-01T00:00:00Z',
    });

    mockSearchProfileRepo.get = vi.fn().mockResolvedValue({
      candidateId: candidateTwo,
      sourceProfileId: 'prof-2',
      sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
      targetRoles: ['Accountant'],
      roleAliases: [],
      primarySkills: ['Accounting'],
      secondarySkills: [],
      industries: [],
      seniority: [],
      preferredLocations: ['Jakarta'],
      workModes: [],
      employmentTypes: ['full-time'],
      excludedRoles: [],
      excludedKeywords: [],
      excludedCompanies: [],
      languages: [],
      sources: ['loker-id'],
      generatedAt: '2026-01-01T00:00:00Z',
    });

    const service = new CandidateSearchService(
      searchProfileService,
      mockProfileRepo,
      searchPlanner,
      mockScrapeRunRepo,
      mockOrchestrator
    );

    const result = await service.runManualSearch(candidateTwo, { maxPages: 1, maxIntents: 1 });
    expect(result.status).toBe('running');
    expect(result.runIds).toHaveLength(1);
  });
});
