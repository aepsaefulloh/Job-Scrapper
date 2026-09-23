import type { ScrapeSummary } from './scraper.orchestrator.js';

export type ScrapeRunStart = { candidateId: string; source: string; keyword?: string; location?: string };
export type ScrapeRunStatus = 'completed' | 'partial' | 'failed';
export interface ScrapeRunRepository { start(input: ScrapeRunStart): Promise<{ id: string }>; finish(id: string, input: { status: ScrapeRunStatus; discovered: number; inserted: number; updated: number; duplicates: number; failed: number; errorCode?: string; errorMessage?: string }): Promise<void>; }
export class ScrapeRunService {
  public constructor(private readonly repository: ScrapeRunRepository) {}
  public async execute(input: ScrapeRunStart, work: () => Promise<ScrapeSummary>): Promise<ScrapeSummary & { runId: string; status: ScrapeRunStatus }> {
    const run = await this.repository.start(input);
    try {
      const result = await work(); const status: ScrapeRunStatus = result.failed ? 'partial' : 'completed';
      await this.repository.finish(run.id, { status, discovered: result.discovered, inserted: result.inserted, updated: result.updated, duplicates: result.duplicates, failed: result.failed });
      return { ...result, runId: run.id, status };
    } catch (error) {
      await this.repository.finish(run.id, { status: 'failed', discovered: 0, inserted: 0, updated: 0, duplicates: 0, failed: 0, errorCode: 'SCRAPE_FAILED', errorMessage: 'Scrape execution failed.' });
      throw error;
    }
  }
}
