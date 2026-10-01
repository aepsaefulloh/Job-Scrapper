import type { BrowserService } from '../../../browser/browser.interface.js';
import type { Logger } from '../../../logging/logger.interface.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from '../../scraper.interface.js';
import { parseLokerIdDetailPage, parseLokerIdSearchPage } from './loker-id.parser.js';
import { retryTransient } from '../../retry.js';

export class LokerIdScraper implements JobScraper {
  public readonly source = 'loker-id';

  public constructor(
    private readonly browser: BrowserService,
    private readonly baseUrl = 'https://www.loker.id',
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
            const path = page > 1 ? `/cari-lowongan-kerja/page/${page}` : '/cari-lowongan-kerja';
            const url = new URL(path, this.baseUrl);
            if (query.keyword) url.searchParams.set('q', query.keyword);
            if (query.location) url.searchParams.set('lokasi', query.location.trim().toLowerCase());

            await session.goto(url.toString());
            let content = await session.getContent();

            // If loker.id returns a 404 page due to an unrecognized location slug, fall back to searching combined query
            if (query.location && content.includes('Halaman Tidak Ditemukan')) {
              const fallbackUrl = new URL(path, this.baseUrl);
              const combinedQuery = [query.keyword, query.location].filter(Boolean).join(' ');
              if (combinedQuery) fallbackUrl.searchParams.set('q', combinedQuery);
              await session.goto(fallbackUrl.toString());
              content = await session.getContent();
            }

            const { jobs: summaries, pagination } = parseLokerIdSearchPage(content, this.baseUrl);

            for (const summary of summaries) {
              if (jobs.has(summary.jobUrl)) continue;

              try {
                await session.goto(summary.jobUrl);
                const detailContent = await session.getContent();
                const detail = parseLokerIdDetailPage(detailContent);

                if (detail && detail.description) {
                  jobs.set(summary.jobUrl, {
                    ...summary,
                    description: detail.description,
                    skills: detail.skills ?? summary.skills,
                    workMode: detail.workMode && detail.workMode !== 'unknown' ? detail.workMode : summary.workMode,
                    employmentType: detail.employmentType ?? summary.employmentType,
                    salaryMin: detail.salaryMin ?? summary.salaryMin,
                    salaryMax: detail.salaryMax ?? summary.salaryMax,
                    salaryCurrency: detail.salaryCurrency ?? summary.salaryCurrency,
                  });
                } else {
                  jobs.set(summary.jobUrl, summary);
                }
              } catch (detailErr) {
                // One failed detail page must not abort the entire scrape run
                this.logger?.warn?.({
                  event: 'scraper.loker_id.detail_failed',
                  jobUrl: summary.jobUrl,
                  error: detailErr instanceof Error ? detailErr.message : 'Detail navigation failed',
                });
                jobs.set(summary.jobUrl, summary);
              }
            }

            // If we've reached the last available page according to metadata, break early
            if (pagination.last_page && page >= pagination.last_page) {
              break;
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
