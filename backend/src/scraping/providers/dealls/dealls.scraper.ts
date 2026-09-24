import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import { parseDeallsDetailPage, parseDeallsSearchPage } from './dealls.parser.js';
import { retryTransient } from '../../retry.js';

export class DeallsScraper implements JobScraper {
  public readonly source = 'dealls';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://dealls.com',
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
            const url = new URL('/loker', this.baseUrl);
            if (query.keyword) url.searchParams.set('q', query.keyword);
            if (query.location) url.searchParams.set('location', query.location);
            if (query.page !== undefined || pageCount > 1) {
              url.searchParams.set('page', String(page));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();
            const summaries = parseDeallsSearchPage(searchHtml, this.baseUrl);

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              try {
                await session.goto(summary.jobUrl);
                const detailHtml = await session.getContent();
                const description = parseDeallsDetailPage(detailHtml);
                if (description) {
                  jobs.set(summary.jobUrl, { ...summary, description });
                  continue;
                }
              } catch (detailErr) {
                // One failed detail page must not abort the entire scrape run
                this.logger?.warn?.({
                  event: 'scraper.dealls.detail_failed',
                  jobUrl: summary.jobUrl,
                  error: detailErr instanceof Error ? detailErr.message : 'Detail navigation failed',
                });
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
