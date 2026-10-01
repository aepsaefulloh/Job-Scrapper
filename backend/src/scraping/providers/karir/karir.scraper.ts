import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import {
  parseKarirDetailPage,
  parseKarirSearchPage,
  parseKarirApiOpportunity,
  parseKarirApiDetail,
} from './karir.parser.js';
import type { KarirSearchApiResponse, KarirDetailApiResponse } from './karir.types.js';
import { retryTransient } from '../../retry.js';

interface MasterLocation {
  id: number;
  name: string;
  province_id?: number;
}

export class KarirScraper implements JobScraper {
  public readonly source = 'karir';
  private cachedLocations: MasterLocation[] | null = null;

  public constructor(
    private readonly browser?: BrowserService,
    private readonly baseUrl = 'https://karir.com',
    private readonly logger?: Logger,
    private readonly apiBaseUrl = 'https://gateway2-beta.karir.com'
  ) {}

  public async search(query: JobSearchQuery): Promise<ScrapedJob[]> {
    // 1. Try Karir Gateway API first (fast and reliable)
    try {
      const apiJobs = await this.searchViaApi(query);
      if (apiJobs.length > 0) {
        return apiJobs;
      }
    } catch (err) {
      this.logger?.warn?.({
        event: 'scraper.karir.api_fallback',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Fall back to browser session if browser is provided
    if (this.browser) {
      return await this.searchViaBrowser(query);
    }

    return [];
  }

  private async getMasterLocations(): Promise<MasterLocation[]> {
    if (this.cachedLocations) return this.cachedLocations;
    try {
      const res = await fetch(`${this.apiBaseUrl}/v1/master_locations`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: MasterLocation[] };
        if (Array.isArray(json.data)) {
          this.cachedLocations = json.data;
          return this.cachedLocations;
        }
      }
    } catch {
      // ignore, fall back to empty
    }
    return [];
  }

  private async resolveLocationIds(locationName?: string): Promise<number[]> {
    if (!locationName) return [];
    const locLower = locationName.toLowerCase().trim();
    const all = await this.getMasterLocations();
    return all
      .filter((l) => l.name && l.name.toLowerCase().includes(locLower))
      .map((l) => l.id);
  }

  private async searchViaApi(query: JobSearchQuery): Promise<ScrapedJob[]> {
    const jobs = new Map<string, ScrapedJob>();
    const firstPage = query.page ?? 1;
    const pageCount = query.maxPages ?? 1;
    const limit = 20;
    const locationIds = await this.resolveLocationIds(query.location);

    for (let page = firstPage; page < firstPage + pageCount; page += 1) {
      const offset = (page - 1) * limit;
      const res = await fetch(`${this.apiBaseUrl}/v2/search/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          keyword: query.keyword || '',
          location_ids: locationIds,
          company_ids: [],
          industry_ids: [],
          job_function_ids: [],
          degree_ids: [],
          locale: 'id',
          limit,
          offset,
          is_opportunity: true,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`Karir search API returned HTTP ${res.status}`);
      }

      const json = (await res.json()) as KarirSearchApiResponse;
      const opportunities = json.data?.opportunities;
      if (!Array.isArray(opportunities) || opportunities.length === 0) {
        break;
      }

      let detailCount = 0;
      const maxDetails = query.detailLimit ?? 10;

      for (const item of opportunities) {
        const parsed = parseKarirApiOpportunity(item, this.baseUrl);
        if (jobs.has(parsed.jobUrl)) continue;

        if (detailCount < maxDetails && item.id) {
          detailCount++;
          try {
            const detailRes = await fetch(`${this.apiBaseUrl}/v1/opportunity/detail`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
              },
              body: JSON.stringify({ opportunity_id: item.id, language: 'id' }),
              signal: AbortSignal.timeout(5000),
            });

            if (detailRes.ok) {
              const detailJson = (await detailRes.json()) as KarirDetailApiResponse;
              if (detailJson.data) {
                const detail = parseKarirApiDetail(detailJson.data);
                if (detail.description) {
                  jobs.set(parsed.jobUrl, {
                    ...parsed,
                    description: detail.description,
                    skills: detail.skills ?? parsed.skills,
                  });
                  continue;
                }
              }
            }
          } catch (detailErr) {
            this.logger?.warn?.({
              event: 'scraper.karir.detail_failed',
              jobUrl: parsed.jobUrl,
              error: detailErr instanceof Error ? detailErr.message : 'Detail fetch failed',
            });
          }
        }

        jobs.set(parsed.jobUrl, parsed);
      }
    }

    return [...jobs.values()];
  }

  private async searchViaBrowser(query: JobSearchQuery): Promise<ScrapedJob[]> {
    if (!this.browser) return [];
    const session = await this.browser.createSession();
    try {
      return await retryTransient(
        async () => {
          const jobs = new Map<string, ScrapedJob>();
          const firstPage = query.page ?? 1;
          const pageCount = query.maxPages ?? 1;

          for (let page = firstPage; page < firstPage + pageCount; page += 1) {
            const url = new URL('/search', this.baseUrl);
            if (query.keyword) url.searchParams.set('keyword', query.keyword);
            if (query.location) url.searchParams.set('location', query.location);
            if (page > 1) {
              url.searchParams.set('page', String(page));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();
            const summaries = parseKarirSearchPage(searchHtml, this.baseUrl);

            let detailCount = 0;
            const maxDetails = query.detailLimit ?? 10;

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              if (detailCount < maxDetails) {
                detailCount++;
                try {
                  await session.goto(summary.jobUrl);
                  const detailHtml = await session.getContent();
                  const detail = parseKarirDetailPage(detailHtml);
                  if (detail && detail.description) {
                    jobs.set(summary.jobUrl, {
                      ...summary,
                      description: detail.description,
                      skills: detail.skills ?? summary.skills,
                    });
                    continue;
                  }
                } catch (detailErr) {
                  this.logger?.warn?.({
                    event: 'scraper.karir.detail_failed',
                    jobUrl: summary.jobUrl,
                    error: detailErr instanceof Error ? detailErr.message : 'Detail navigation failed',
                  });
                }
              }

              jobs.set(summary.jobUrl, summary);
            }
          }

          return [...jobs.values()];
        },
        { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 1_000 }
      );
    } finally {
      await session.close();
    }
  }
}

