import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import { parseGlintsDetailPage, parseGlintsSearchPage } from './glints.parser.js';
import { retryTransient } from '../../retry.js';

export class GlintsScraper implements JobScraper {
  public readonly source = 'glints';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://glints.com',
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
            const url = new URL('/id/opportunities/jobs/explore', this.baseUrl);
            if (query.keyword) url.searchParams.set('keyword', query.keyword);
            if (query.location) url.searchParams.set('location', query.location);
            if (query.page !== undefined || pageCount > 1) {
              url.searchParams.set('page', String(page));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();
            const summaries = parseGlintsSearchPage(searchHtml, this.baseUrl);

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              try {
                await session.goto(summary.jobUrl);
                const detailHtml = await session.getContent();
                const description = parseGlintsDetailPage(detailHtml);
                if (description) {
                  jobs.set(summary.jobUrl, { ...summary, description });
                  continue;
                }
              } catch (detailErr) {
                // If detail extraction fails for a single job, keep the summary without description
                this.logger?.warn?.({
                  event: 'scraper.glints.detail_failed',
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
