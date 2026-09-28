import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import {
  detectIndeedChallenge,
  parseIndeedDetailPage,
  parseIndeedSearchPage,
} from './indeed.parser.js';
import { retryTransient } from '../../retry.js';

export class IndeedScraper implements JobScraper {
  public readonly source = 'indeed';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://id.indeed.com',
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
            const url = new URL('/jobs', this.baseUrl);
            if (query.keyword) url.searchParams.set('q', query.keyword);
            if (query.location) url.searchParams.set('l', query.location);
            if (days > 0) url.searchParams.set('fromage', String(days));
            if (page > 1) {
              url.searchParams.set('start', String((page - 1) * 10));
            }

            await session.goto(url.toString());
            const searchHtml = await session.getContent();

            if (detectIndeedChallenge(searchHtml)) {
              this.logger?.warn?.({
                event: 'scraper.indeed.challenge_detected',
                url: url.toString(),
                message: 'Bot challenge / verification detected on Indeed search page. Skipping remaining pages gracefully.',
              });
              break;
            }

            const summaries = parseIndeedSearchPage(searchHtml, this.baseUrl);
            let detailCount = 0;
            const maxDetails = query.detailLimit ?? 10;

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              if (detailCount < maxDetails) {
                detailCount++;
                try {
                  await session.goto(summary.jobUrl);
                  const detailHtml = await session.getContent();
                  if (detectIndeedChallenge(detailHtml)) {
                    this.logger?.warn?.({
                      event: 'scraper.indeed.challenge_detected',
                      jobUrl: summary.jobUrl,
                      message: 'Bot challenge detected on Indeed detail page',
                    });
                    jobs.set(summary.jobUrl, summary);
                    continue;
                  }

                  const detail = parseIndeedDetailPage(detailHtml);
                  if (detail && detail.description) {
                    jobs.set(summary.jobUrl, {
                      ...summary,
                      description: detail.description,
                    });
                    continue;
                  }
                } catch (detailErr) {
                  this.logger?.warn?.({
                    event: 'scraper.indeed.detail_failed',
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
