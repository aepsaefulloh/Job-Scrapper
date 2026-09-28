import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import { parseKitaLulusDetailPage, parseKitaLulusSearchPage } from './kitalulus.parser.js';
import { retryTransient } from '../../retry.js';

export class KitaLulusScraper implements JobScraper {
  public readonly source = 'kitalulus';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://kerja.kitalulus.com',
    private readonly logger?: Logger
  ) {}

  public async search(query: JobSearchQuery): Promise<ScrapedJob[]> {
    const session = await this.browser.createSession();
    try {
      return await retryTransient(
        async () => {
          const jobs = new Map<string, ScrapedJob>();
          const firstPage = query.page ?? 1;
          const pageCount = query.maxPages ?? 1;

          for (let page = firstPage; page < firstPage + pageCount; page += 1) {
            const url = new URL('/id/lowongan', this.baseUrl);
            if (query.keyword) url.searchParams.set('q', query.keyword);
            if (query.location) url.searchParams.set('lokasi', query.location);
            if (page > 1) {
              url.searchParams.set('page', String(page));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();
            const summaries = parseKitaLulusSearchPage(searchHtml, this.baseUrl);

            let detailCount = 0;
            const maxDetails = query.detailLimit ?? 10;

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              if (detailCount < maxDetails) {
                detailCount++;
                try {
                  await session.goto(summary.jobUrl);
                  const detailHtml = await session.getContent();
                  const detail = parseKitaLulusDetailPage(detailHtml);
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
                    event: 'scraper.kitalulus.detail_failed',
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
