import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import {
  detectLinkedInAuthWall,
  parseLinkedInDetailPage,
  parseLinkedInSearchPage,
} from './linkedin.parser.js';
import { retryTransient } from '../../retry.js';

export class LinkedInScraper implements JobScraper {
  public readonly source = 'linkedin';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://www.linkedin.com',
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
          const days = query.maxPostingAgeDays ?? 7;

          for (let page = firstPage; page < firstPage + pageCount; page += 1) {
            const url = new URL('/jobs/search', this.baseUrl);
            if (query.keyword) url.searchParams.set('keywords', query.keyword);
            if (query.location) url.searchParams.set('location', query.location);
            if (days > 0) {
              // LinkedIn format: r + seconds (e.g. r604800 for 7 days)
              url.searchParams.set('f_TPR', `r${days * 86400}`);
            }
            if (page > 1) {
              url.searchParams.set('start', String((page - 1) * 25));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();

            if (detectLinkedInAuthWall(searchHtml)) {
              this.logger?.warn?.({
                event: 'scraper.linkedin.authwall_detected',
                url: url.toString(),
                message: 'LinkedIn authwall or login wall detected. Skipping remaining search pages gracefully.',
              });
              break;
            }

            const summaries = parseLinkedInSearchPage(searchHtml, this.baseUrl);
            let detailCount = 0;
            const maxDetails = query.detailLimit ?? 10;

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              if (detailCount < maxDetails) {
                detailCount++;
                try {
                  await session.goto(summary.jobUrl);
                  const detailHtml = await session.getContent();
                  if (detectLinkedInAuthWall(detailHtml)) {
                    this.logger?.warn?.({
                      event: 'scraper.linkedin.authwall_detected',
                      jobUrl: summary.jobUrl,
                      message: 'LinkedIn authwall detected on detail page',
                    });
                    jobs.set(summary.jobUrl, summary);
                    continue;
                  }

                  const detail = parseLinkedInDetailPage(detailHtml);
                  if (detail && detail.description) {
                    jobs.set(summary.jobUrl, {
                      ...summary,
                      description: detail.description,
                    });
                    continue;
                  }
                } catch (detailErr) {
                  this.logger?.warn?.({
                    event: 'scraper.linkedin.detail_failed',
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
        { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 1_500 }
      );
    } finally {
      await session.close();
    }
  }
}
