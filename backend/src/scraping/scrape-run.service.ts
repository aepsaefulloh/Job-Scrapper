import type { ScrapeSummary } from './scraper.orchestrator.js';

export type ScrapeRunStart = {
  candidateId: string;
  source: string;
  keyword?: string;
  location?: string;
  metadata?: Record<string, unknown>;
};

export type ScrapeRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface ScrapeRunRecord {
  id: string;
  candidateId: string;
  source: string;
  keyword: string | null;
  location: string | null;
  status: ScrapeRunStatus;
  startedAt: string;
  finishedAt: string | null;
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  trigger?: 'manual' | 'scheduled';
  createdAt: string;
}

export interface ScrapeRunRepository {
  start(input: ScrapeRunStart): Promise<{ id: string }>;
  finish(
    id: string,
    input: {
      status: ScrapeRunStatus;
      discovered: number;
      inserted: number;
      updated: number;
      duplicates: number;
      failed: number;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void>;
  hasActiveRun?(
    candidateId: string,
    search: { source: string; keyword: string; location?: string },
    identity: string
  ): Promise<boolean>;
  hasAnyActiveRun?(candidateId: string): Promise<boolean>;
  list?(candidateId: string, limit?: number): Promise<ScrapeRunRecord[]>;
  getLatest?(candidateId: string): Promise<ScrapeRunRecord | null>;
  getById?(candidateId: string, runId: string): Promise<ScrapeRunRecord | null>;
}

export class ScrapeRunService {
  public constructor(private readonly repository: ScrapeRunRepository) {}

  public async execute(
    input: ScrapeRunStart,
    work: () => Promise<ScrapeSummary>
  ): Promise<ScrapeSummary & { runId: string; status: ScrapeRunStatus }> {
    const run = await this.repository.start(input);
    try {
      const result = await work();
      const status: ScrapeRunStatus = result.failed ? 'partial' : 'completed';
      await this.repository.finish(run.id, {
        status,
        discovered: result.discovered,
        inserted: result.inserted,
        updated: result.updated,
        duplicates: result.duplicates,
        failed: result.failed,
      });
      return { ...result, runId: run.id, status };
    } catch (error) {
      await this.repository.finish(run.id, {
        status: 'failed',
        discovered: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        failed: 0,
        errorCode: 'SCRAPE_FAILED',
        errorMessage: 'Scrape execution failed.',
      });
      throw error;
    }
  }

  public async list(candidateId: string, limit = 10): Promise<ScrapeRunRecord[]> {
    if (!this.repository.list) return [];
    return this.repository.list(candidateId, Math.min(Math.max(1, limit), 50));
  }

  public async getLatest(candidateId: string): Promise<ScrapeRunRecord | null> {
    if (!this.repository.getLatest) return null;
    return this.repository.getLatest(candidateId);
  }

  public async getById(candidateId: string, runId: string): Promise<ScrapeRunRecord | null> {
    if (!this.repository.getById) return null;
    return this.repository.getById(candidateId, runId);
  }

  public async hasAnyActiveRun(candidateId: string): Promise<boolean> {
    if (!this.repository.hasAnyActiveRun) return false;
    return this.repository.hasAnyActiveRun(candidateId);
  }
}
