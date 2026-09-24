import type { RawJobInput } from '../domain/job/job-types.js';
import { parseRelativeDate } from '../domain/job/relative-date-parser.js';
import type { Logger } from '../logging/logger.interface.js';
import { evaluateFreshness, type FreshnessFilterOptions } from '../search/freshness-filter.js';
import type { JobScraper, JobSearchQuery, ScrapedJob } from './scraper.interface.js';

export type ScrapeRequest = {
  candidateId: string;
  source: string;
  query: JobSearchQuery;
  freshness?: FreshnessFilterOptions;
};

export type ScrapeSummary = {
  source: string;
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  expiredByAge?: number;
};

type Ingestion = {
  ingest(
    input: RawJobInput,
    candidateId: string
  ): Promise<{ jobId: string; changed: boolean; created?: boolean }>;
};

type Embedding = {
  embed(jobId: string): Promise<void>;
};

export class ScraperOrchestrator {
  public constructor(
    private readonly scrapers: JobScraper[],
    private readonly ingestion: Ingestion,
    private readonly embedding: Embedding,
    private readonly logger?: Logger
  ) {}

  public async run(request: ScrapeRequest): Promise<ScrapeSummary> {
    const scraper = this.scrapers.find((candidate) => candidate.source === request.source);
    if (!scraper) {
      throw Object.assign(new Error(`Unsupported scraper source: ${request.source}`), {
        code: 'UNSUPPORTED_SOURCE',
      });
    }

    const started = Date.now();
    this.logger?.info({
      event: 'scrape.started',
      source: scraper.source,
      keyword: request.query.keyword,
      location: request.query.location,
      stage: 'search',
    });

    const jobs = await scraper.search(request.query);
    this.logger?.info({
      event: 'scrape.search.completed',
      source: scraper.source,
      stage: 'search',
      discovered: jobs.length,
      durationMs: Date.now() - started,
    });

    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let failed = 0;
    let expiredByAge = 0;

    for (const job of jobs) {
      try {
        const rawJob = toRawJob(job);
        const result = await this.ingestion.ingest(rawJob, request.candidateId);

        this.logger?.info({
          event: 'scrape.ingestion.completed',
          source: scraper.source,
          stage: 'ingestion',
          jobId: result.jobId,
        });

        if (result.changed) {
          if (result.created) inserted += 1;
          else updated += 1;

          // Freshness evaluation before expensive embedding/matching
          if (request.freshness) {
            const pubAt = rawJob.payload.publishedAt as string | undefined;
            const freshness = evaluateFreshness(pubAt, request.freshness);
            if (!freshness.eligible) {
              expiredByAge += 1;
              this.logger?.info({
                event: 'scrape.freshness.filtered',
                source: scraper.source,
                stage: 'freshness',
                reason: freshness.reason,
                jobId: result.jobId,
                publishedAt: pubAt,
              });
              continue;
            }
          }

          try {
            await this.embedding.embed(result.jobId);
          } catch {
            failed += 1;
            this.logger?.warn({
              event: 'scrape.embedding.failed',
              source: scraper.source,
              stage: 'embedding',
              errorCode: 'EMBEDDING_FAILED',
              jobId: result.jobId,
            });
          }
        } else {
          duplicates += 1;
        }
      } catch (ingestErr) {
        failed += 1;
        this.logger?.warn({
          event: 'scrape.detail.failed',
          source: scraper.source,
          stage: 'ingestion',
          errorCode: 'INGESTION_FAILED',
          message: ingestErr instanceof Error ? ingestErr.message : 'Ingestion failed',
        });
      }
    }

    const summary: ScrapeSummary = {
      source: scraper.source,
      discovered: jobs.length,
      inserted,
      updated,
      duplicates,
      failed,
      expiredByAge,
    };

    this.logger?.info({
      event: failed ? 'scrape.partial' : 'scrape.completed',
      stage: 'scrape_run',
      durationMs: Date.now() - started,
      ...summary,
    });

    return summary;
  }
}

function toRawJob(job: ScrapedJob): RawJobInput {
  const publishedAt =
    parseRelativeDate(job.publishedAt, new Date(job.scrapedAt)) ?? job.publishedAt;

  const description =
    job.description && job.description.trim().length > 0
      ? job.description
      : `${job.title} at ${job.company ?? 'Unknown'}`;

  return {
    source: job.source,
    ...(job.externalId ? { externalId: job.externalId } : {}),
    url: job.jobUrl,
    fetchedAt: job.scrapedAt,
    payload: {
      title: job.title,
      company: job.company ?? 'Unknown',
      description,
      location: job.location,
      employmentType: job.employmentType,
      workplaceType: job.workMode,
      publishedAt,
      metadata: job.metadata,
    },
  };
}
