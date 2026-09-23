import type { BrowserService } from '../../../browser/browser.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import { parseJobstreetDetailPage, parseJobstreetSearchPage } from './jobstreet.parser.js';
import { retryTransient } from '../../retry.js';

export class JobstreetScraper implements JobScraper {
  public readonly source = 'jobstreet';
  public constructor(private readonly browser: BrowserService, private readonly baseUrl = 'https://id.jobstreet.com') {}
  public async search(query: JobSearchQuery): Promise<ScrapedJob[]> {
    const session = await this.browser.createSession();
    try {
      return await retryTransient(async () => {
        const jobs = new Map<string, ScrapedJob>();
        const firstPage = query.page ?? 1;
        const pageCount = query.maxPages ?? 1;
        for (let page = firstPage; page < firstPage + pageCount; page += 1) {
          const url = new URL('/id/jobs', this.baseUrl);
          if (query.keyword) url.searchParams.set('keyword', query.keyword);
          if (query.location) url.searchParams.set('location', query.location);
          if (query.page !== undefined || pageCount > 1) url.searchParams.set('page', String(page));
          await session.goto(url.toString());
          const summaries = parseJobstreetSearchPage(await session.getContent(), this.baseUrl);
          for (const summary of summaries) {
            if (jobs.has(summary.jobUrl)) continue;
            await session.goto(summary.jobUrl);
            const description = parseJobstreetDetailPage(await session.getContent());
            if (description) jobs.set(summary.jobUrl, { ...summary, description });
          }
        }
        return [...jobs.values()];
      }, { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 1_000 });
    }
    finally { await session.close(); }
  }
}
