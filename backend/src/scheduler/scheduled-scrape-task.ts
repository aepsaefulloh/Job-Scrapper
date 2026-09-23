import { createHash } from 'node:crypto';
import type { Logger } from '../logging/logger.interface.js';

export type ScheduledJobSearch = { source: string; keyword: string; location?: string; maxPages?: number };
type ActiveRunGuard = { hasActiveRun(candidateId: string, search: ScheduledJobSearch, identity: string): Promise<boolean> };
type ExecuteScheduledSearch = (candidateId: string, search: ScheduledJobSearch) => Promise<unknown>;

function normalize(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
export function normalizeScheduledSearch(search: ScheduledJobSearch): ScheduledJobSearch {
  return { source: normalize(search.source), keyword: normalize(search.keyword), ...(search.location?.trim() ? { location: normalize(search.location) } : {}), ...(search.maxPages === undefined ? {} : { maxPages: search.maxPages }) };
}
export function buildSearchIdentity(search: ScheduledJobSearch): string {
  const normalized = normalizeScheduledSearch(search);
  return createHash('sha256').update([normalized.source, normalized.keyword, normalized.location ?? ''].join('\n')).digest('hex');
}

export class ScheduledScrapeTask {
  private readonly active = new Set<string>();
  public constructor(private readonly guard: ActiveRunGuard, private readonly execute: ExecuteScheduledSearch, private readonly logger: Logger) {}
  public async run(candidateId: string, input: ScheduledJobSearch): Promise<unknown> {
    const search = normalizeScheduledSearch(input); const identity = buildSearchIdentity(search); const activeKey = `${candidateId}:${identity}`; const started = Date.now();
    if (this.active.has(activeKey)) { this.logger.info({ event: 'scheduler.search.skipped', source: search.source, keyword: search.keyword, location: search.location, reason: 'ACTIVE_RUN' }); return { status: 'skipped', reason: 'ACTIVE_RUN' }; }
    this.active.add(activeKey);
    try {
      if (await this.guard.hasActiveRun(candidateId, search, identity)) { this.logger.info({ event: 'scheduler.search.skipped', source: search.source, keyword: search.keyword, location: search.location, reason: 'ACTIVE_RUN' }); return { status: 'skipped', reason: 'ACTIVE_RUN' }; }
      this.logger.info({ event: 'scheduler.search.started', source: search.source, keyword: search.keyword, location: search.location });
      const result = await this.execute(candidateId, search); this.logger.info({ event: 'scheduler.search.completed', source: search.source, keyword: search.keyword, location: search.location, durationMs: Date.now() - started, result: 'completed' }); return result;
    }
    catch (error) { this.logger.error({ event: 'scheduler.search.failed', source: search.source, keyword: search.keyword, location: search.location, durationMs: Date.now() - started, errorCode: 'SCHEDULED_SCRAPE_FAILED' }); throw error; }
    finally { this.active.delete(activeKey); }
  }
}
