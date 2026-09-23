import type { Logger } from '../logging/logger.interface.js';
import type { ProfileRepository } from '../infrastructure/supabase/profile-repository.js';
import type { ScrapeRunRepository, ScrapeRunStatus } from '../scraping/scrape-run.service.js';
import type { ScraperOrchestrator } from '../scraping/scraper.orchestrator.js';
import type { JobSearchIntent } from './search-types.js';
import type { SearchProfileService } from './search-profile.service.js';
import type { SearchPlanner } from './search-planner.js';
import type { SearchPreferencesService } from './search-preferences.service.js';
import type { JobSearchPreferences } from './preferences-types.js';
import { buildSearchIdentity, normalizeScheduledSearch } from '../scheduler/scheduled-scrape-task.js';

export class SearchProfileNotReadyError extends Error {
  public readonly code = 'SEARCH_PROFILE_NOT_READY';
  public constructor(message = 'Your job search profile is not ready yet. Complete or update your candidate profile first.') {
    super(message);
    this.name = 'SearchProfileNotReadyError';
  }
}

export class SearchAlreadyRunningError extends Error {
  public readonly code = 'SEARCH_ALREADY_RUNNING';
  public constructor(message = 'A search is already running for this query.') {
    super(message);
    this.name = 'SearchAlreadyRunningError';
  }
}

export interface CandidateSearchExecutionResponse {
  status: 'running';
  runIds: string[];
  sources?: string[];
  locations?: string[];
  maxPostingAgeDays?: number;
}

export class CandidateSearchService {
  private readonly supportedSources = new Set(['jobstreet', 'loker-id']);

  public constructor(
    private readonly searchProfileService: SearchProfileService,
    private readonly profileRepo: ProfileRepository,
    private readonly searchPlanner: SearchPlanner,
    private readonly scrapeRunRepo: ScrapeRunRepository,
    private readonly orchestrator: ScraperOrchestrator,
    private readonly logger?: Logger,
    private readonly searchPreferencesService?: SearchPreferencesService
  ) {}

  /**
   * Run candidate-driven search manually triggered from the UI.
   * Validates profile readiness and per-search concurrency, registers runs,
   * kicks off scraping in the background, and returns immediately.
   */
  public async runManualSearch(
    candidateId: string,
    options: { maxPages?: number; maxIntents?: number } = {}
  ): Promise<CandidateSearchExecutionResponse> {
    const candidateProfile = await this.profileRepo.getActiveProfile(candidateId);
    if (!candidateProfile) {
      throw new SearchProfileNotReadyError();
    }

    const searchProfile = await this.searchProfileService.getOrDerive(candidateId, candidateProfile);
    const preferences = await this.searchPreferencesService?.getPreferences(candidateId);

    const allIntents = this.searchPlanner.createIntents(
      { searchProfile, preferences },
      {
        defaultMaxPages: options.maxPages ?? 1,
      }
    );

    const validIntents = allIntents.filter((intent) => this.supportedSources.has(intent.source));
    if (validIntents.length === 0) {
      throw new SearchProfileNotReadyError('No supported search sources enabled for your profile.');
    }

    const maxIntents = options.maxIntents ?? 3;
    const candidateIntents = validIntents.slice(0, maxIntents);

    const intentsToRun: JobSearchIntent[] = [];
    for (const intent of candidateIntents) {
      const normalized = normalizeScheduledSearch({
        source: intent.source,
        keyword: intent.keyword,
        location: intent.location,
      });
      const identity = buildSearchIdentity(normalized);
      const isActive = this.scrapeRunRepo.hasActiveRun
        ? await this.scrapeRunRepo.hasActiveRun(candidateId, normalized, identity)
        : await this.scrapeRunRepo.hasAnyActiveRun?.(candidateId);

      if (isActive) {
        this.logger?.info({
          event: 'search.manual.skipped',
          candidateId,
          source: intent.source,
          keyword: intent.keyword,
          location: intent.location,
          reason: 'ACTIVE_RUN',
        });
        continue;
      }
      intentsToRun.push(intent);
    }

    if (intentsToRun.length === 0) {
      throw new SearchAlreadyRunningError();
    }

    const startedRuns: { runId: string; intent: JobSearchIntent }[] = [];
    for (const intent of intentsToRun) {
      const run = await this.scrapeRunRepo.start({
        candidateId,
        source: intent.source,
        keyword: intent.keyword,
        location: intent.location,
        metadata: { trigger: 'manual' },
      });
      startedRuns.push({ runId: run.id, intent });
    }

    this.logger?.info({
      event: 'search.manual.started',
      candidateId,
      runCount: startedRuns.length,
      runIds: startedRuns.map((r) => r.runId),
      sources: preferences?.sources,
      locations: preferences?.locations,
      maxPostingAgeDays: preferences?.maxPostingAgeDays,
    });

    // Execute in background
    void this.executeRuns(candidateId, startedRuns, preferences);

    return {
      status: 'running',
      runIds: startedRuns.map((r) => r.runId),
      sources: preferences?.sources,
      locations: preferences?.locations,
      maxPostingAgeDays: preferences?.maxPostingAgeDays,
    };
  }

  /**
   * Execute scheduled searches from candidate plan or fallback.
   */
  public async runScheduledSearch(
    candidateId: string,
    fallbackSearches: JobSearchIntent[] = []
  ): Promise<void> {
    let searches: JobSearchIntent[] | null = null;
    let preferences: JobSearchPreferences | undefined;

    try {
      preferences = await this.searchPreferencesService?.getPreferences(candidateId);
      const candidateProfile = await this.profileRepo.getActiveProfile(candidateId);
      if (!candidateProfile) {
        this.logger?.info({
          event: 'scheduler.search_profile.not_available',
          candidateId,
          errorCode: 'SEARCH_PROFILE_NOT_AVAILABLE',
          message: 'No active candidate profile found, falling back to scheduled searches configuration.',
        });
        searches = fallbackSearches;
      } else {
        const searchProfile = await this.searchProfileService.getOrDerive(candidateId, candidateProfile);
        searches = this.searchPlanner.createIntents(
          { searchProfile, preferences },
          { defaultMaxPages: 2 }
        );
        this.logger?.info({
          event: 'scheduler.candidate_plan.selected',
          candidateId,
          intentCount: searches.length,
          roles: searchProfile.targetRoles,
        });
      }
    } catch (err) {
      this.logger?.error({
        event: 'scheduler.search_profile.failed',
        candidateId,
        errorCode: 'SEARCH_PROFILE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to resolve search profile',
      });
      return;
    }

    if (!searches || searches.length === 0) return;

    for (const search of searches) {
      if (!this.supportedSources.has(search.source)) continue;

      const normalized = normalizeScheduledSearch({
        source: search.source,
        keyword: search.keyword,
        location: search.location,
      });
      const identity = buildSearchIdentity(normalized);
      const hasActive = this.scrapeRunRepo.hasActiveRun
        ? await this.scrapeRunRepo.hasActiveRun(candidateId, normalized, identity)
        : await this.scrapeRunRepo.hasAnyActiveRun?.(candidateId);

      if (hasActive) {
        this.logger?.info({
          event: 'scheduler.run.skipped',
          candidateId,
          source: search.source,
          keyword: search.keyword,
          location: search.location,
          reason: 'ACTIVE_RUN',
        });
        continue;
      }

      const run = await this.scrapeRunRepo.start({
        candidateId,
        source: search.source,
        keyword: search.keyword,
        location: search.location,
        metadata: { trigger: 'scheduled' },
      });

      await this.executeSingleRun(candidateId, run.id, search, preferences);
    }
  }

  private async executeRuns(
    candidateId: string,
    runs: { runId: string; intent: JobSearchIntent }[],
    preferences?: JobSearchPreferences
  ): Promise<void> {
    for (const { runId, intent } of runs) {
      await this.executeSingleRun(candidateId, runId, intent, preferences);
    }
  }

  private async executeSingleRun(
    candidateId: string,
    runId: string,
    intent: JobSearchIntent,
    preferences?: JobSearchPreferences
  ): Promise<void> {
    try {
      const summary = await this.orchestrator.run({
        candidateId,
        source: intent.source,
        query: {
          keyword: intent.keyword,
          location: intent.location,
          maxPages: intent.maxPages ?? 1,
          maxPostingAgeDays: preferences?.maxPostingAgeDays,
        },
        freshness: preferences
          ? {
              maxPostingAgeDays: preferences.maxPostingAgeDays,
              unknownPostingDatePolicy: preferences.unknownPostingDatePolicy,
            }
          : undefined,
      });

      const status: ScrapeRunStatus = summary.failed ? 'partial' : 'completed';
      await this.scrapeRunRepo.finish(runId, {
        status,
        discovered: summary.discovered,
        inserted: summary.inserted,
        updated: summary.updated,
        duplicates: summary.duplicates,
        failed: summary.failed,
      });

      this.logger?.info({
        event: 'search.run.finished',
        candidateId,
        runId,
        status,
        summary,
      });
    } catch (error) {
      await this.scrapeRunRepo.finish(runId, {
        status: 'failed',
        discovered: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        failed: 0,
        errorCode: 'SCRAPE_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Scrape execution failed.',
      });

      this.logger?.error({
        event: 'search.run.failed',
        candidateId,
        runId,
        error: error instanceof Error ? error.message : 'Scrape execution failed.',
      });
    }
  }
}
