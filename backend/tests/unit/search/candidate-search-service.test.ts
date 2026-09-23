import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CandidateSearchService,
  SearchAlreadyRunningError,
  SearchProfileNotReadyError,
} from '../../../src/search/candidate-search.service.js';
import type { ProfileRepository } from '../../../src/infrastructure/supabase/profile-repository.js';
import type { ScrapeRunRepository } from '../../../src/scraping/scrape-run.service.js';
import type { ScraperOrchestrator } from '../../../src/scraping/scraper.orchestrator.js';
import { SearchPlanner } from '../../../src/search/search-planner.js';
import { SearchProfileService } from '../../../src/search/search-profile.service.js';

describe('CandidateSearchService', () => {
  const candidateId = 'cand-123';
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
        headline: 'Frontend Engineer',
        summary: 'Experienced developer',
        experience: 'Company A',
        careerPreferences: null,
        skills: [{ displayName: 'Vue.js', canonicalName: 'vue.js' }],
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      createProfile: vi.fn(),
      saveDocument: vi.fn(),
      getDocument: vi.fn(),
    };

    mockScrapeRunRepo = {
      start: vi.fn().mockResolvedValue({ id: 'run-999' }),
      finish: vi.fn().mockResolvedValue(undefined),
      hasActiveRun: vi.fn().mockResolvedValue(false),
      hasAnyActiveRun: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      getLatest: vi.fn().mockResolvedValue(null),
      getById: vi.fn().mockResolvedValue(null),
    };

    mockOrchestrator = {
      run: vi.fn().mockResolvedValue({
        source: 'jobstreet',
        discovered: 10,
        inserted: 8,
        updated: 1,
        duplicates: 1,
        failed: 0,
      }),
    } as unknown as ScraperOrchestrator;

    mockSearchProfileRepo = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    searchProfileService = new SearchProfileService(mockSearchProfileRepo);
    searchPlanner = new SearchPlanner();
  });

  describe('runManualSearch', () => {
    it('throws SearchProfileNotReadyError if active profile does not exist', async () => {
      mockProfileRepo.getActiveProfile = vi.fn().mockResolvedValue(null);
      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      await expect(service.runManualSearch(candidateId)).rejects.toThrow(SearchProfileNotReadyError);
    });

    it('blocks search when the exact same search query and source is already running', async () => {
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

    it('allows search when a different query or source is running', async () => {
      // Mock: only 'jobstreet' + 'accountant' is active, others are free
      mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
        async (_cid, search: { source: string; keyword: string }) => {
          return search.source === 'jobstreet' && search.keyword === 'accountant';
        }
      );

      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      // The candidate profile has 'Frontend Engineer' headline -> expands to frontend keywords, not 'accountant'
      const result = await service.runManualSearch(candidateId, { maxPages: 1 });
      expect(result.status).toBe('running');
      expect(result.runIds).toHaveLength(2);
    });

    it('allows search on Loker.id when Jobstreet search is running for same keyword', async () => {
      // Mock: jobstreet is running, loker-id is free
      mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
        async (_cid, search: { source: string }) => search.source === 'jobstreet'
      );

      // Candidate profile has both jobstreet and loker-id enabled
      mockSearchProfileRepo.get = vi.fn().mockResolvedValue({
        candidateId,
        sourceProfileId: 'prof-1',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Accountant'],
        roleAliases: [],
        primarySkills: ['Accounting'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: [],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      });

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

    it('starts scrape runs and returns status running with runIds', async () => {
      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      const result = await service.runManualSearch(candidateId, { maxPages: 1 });

      expect(result.status).toBe('running');
      expect(result.runIds).toHaveLength(2);
      expect(result.runIds).toContain('run-999');

      expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId,
          source: 'jobstreet',
          metadata: { trigger: 'manual' },
        })
      );
      expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId,
          source: 'loker-id',
          metadata: { trigger: 'manual' },
        })
      );
    });

    it('filters out unsupported sources cleanly', async () => {
      // Return a profile that only has an unsupported source
      mockSearchProfileRepo.get = vi.fn().mockResolvedValue({
        candidateId,
        sourceProfileId: 'prof-1',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Developer'],
        roleAliases: [],
        primarySkills: ['TypeScript'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: [],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['unsupported_portal'],
        generatedAt: '2026-01-01T00:00:00Z',
      });

      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      await expect(service.runManualSearch(candidateId)).rejects.toThrow(SearchProfileNotReadyError);
    });
  });

  describe('runScheduledSearch', () => {
    it('uses fallback searches when active candidate profile is not available', async () => {
      mockProfileRepo.getActiveProfile = vi.fn().mockResolvedValue(null);
      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      const fallback = [{ source: 'jobstreet', keyword: 'developer', maxPages: 1 }];
      await service.runScheduledSearch(candidateId, fallback);

      expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId,
          source: 'jobstreet',
          keyword: 'developer',
          metadata: { trigger: 'scheduled' },
        })
      );
    });

    it('skips scheduled run if that specific search is already active', async () => {
      mockScrapeRunRepo.hasActiveRun = vi.fn().mockResolvedValue(true);
      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      const fallback = [{ source: 'jobstreet', keyword: 'developer', maxPages: 1 }];
      await service.runScheduledSearch(candidateId, fallback);

      expect(mockScrapeRunRepo.start).not.toHaveBeenCalled();
    });

    it('skips only the active search in scheduled batch while executing the other', async () => {
      mockProfileRepo.getActiveProfile = vi.fn().mockResolvedValue(null);
      // Mock: developer is active, accountant is free
      mockScrapeRunRepo.hasActiveRun = vi.fn().mockImplementation(
        async (_cid, search: { keyword: string }) => search.keyword === 'developer'
      );

      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator
      );

      const fallback = [
        { source: 'jobstreet', keyword: 'developer', maxPages: 1 },
        { source: 'loker-id', keyword: 'accountant', maxPages: 1 },
      ];
      await service.runScheduledSearch(candidateId, fallback);

      expect(mockScrapeRunRepo.start).toHaveBeenCalledTimes(1);
      expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'loker-id',
          keyword: 'accountant',
        })
      );
    });

    it('respects search preferences for sources, locations, and returns summary transparency', async () => {
      mockProfileRepo.getActiveProfile = vi.fn().mockResolvedValue({
        id: 'prof-123',
        candidateId,
        headline: 'Frontend Engineer',
        summary: 'Experienced Vue developer',
        experience: '5 years building SPAs',
        careerPreferences: null,
        skills: [{ displayName: 'Vue.js', canonicalName: 'vue.js' }],
        updatedAt: '2026-01-01T00:00:00Z',
      });
      mockSearchProfileRepo.get = vi.fn().mockResolvedValue(null);
      mockSearchProfileRepo.save = vi.fn().mockResolvedValue(undefined);
      mockScrapeRunRepo.hasActiveRun = vi.fn().mockResolvedValue(false);

      const mockPreferencesService = {
        getPreferences: vi.fn().mockResolvedValue({
          sources: ['loker-id'],
          locations: ['Surabaya'],
          workModes: ['remote'],
          employmentTypes: ['full-time'],
          maxPostingAgeDays: 3,
          unknownPostingDatePolicy: 'exclude',
        }),
      } as any;

      const service = new CandidateSearchService(
        searchProfileService,
        mockProfileRepo,
        searchPlanner,
        mockScrapeRunRepo,
        mockOrchestrator,
        undefined,
        mockPreferencesService
      );

      const res = await service.runManualSearch(candidateId);
      expect(res.status).toBe('running');
      expect(res.sources).toEqual(['loker-id']);
      expect(res.locations).toEqual(['Surabaya']);
      expect(res.maxPostingAgeDays).toBe(3);

      expect(mockScrapeRunRepo.start).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'loker-id',
          location: 'Surabaya',
        })
      );
    });
  });
});
