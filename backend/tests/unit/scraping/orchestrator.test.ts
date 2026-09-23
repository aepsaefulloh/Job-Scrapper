import { describe, expect, it, vi } from 'vitest';
import { ScraperOrchestrator } from '../../../src/scraping/scraper.orchestrator.js';

describe('ScraperOrchestrator', () => {
  it('sends canonical jobs through the existing ingestion service and embeds changed jobs', async () => {
    const ingest = vi.fn().mockResolvedValue({ rawId: 'raw', jobId: 'job', changed: true, created: true });
    const embed = vi.fn().mockResolvedValue(undefined);
    const orchestrator = new ScraperOrchestrator([{ source: 'jobstreet', search: async () => [{ source: 'jobstreet', title: 'Engineer', company: 'Acme', description: 'TypeScript', jobUrl: 'https://example.com/jobs/1', scrapedAt: '2026-09-23T00:00:00.000Z' }] }], { ingest }, { embed });
    await expect(orchestrator.run({ candidateId: 'candidate', source: 'jobstreet', query: { keyword: 'engineer' } })).resolves.toMatchObject({ discovered: 1, inserted: 1, failed: 0 });
    expect(ingest).toHaveBeenCalledWith(expect.objectContaining({ source: 'jobstreet', payload: expect.objectContaining({ title: 'Engineer', company: 'Acme' }) }), 'candidate');
    expect(embed).toHaveBeenCalledWith('job');
  });

  it('filters out stale jobs before embedding when freshness is specified and tracks expiredByAge', async () => {
    const ingest = vi.fn().mockResolvedValue({ rawId: 'raw', jobId: 'job', changed: true, created: true });
    const embed = vi.fn().mockResolvedValue(undefined);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const orchestrator = new ScraperOrchestrator(
      [
        {
          source: 'jobstreet',
          search: async () => [
            {
              source: 'jobstreet',
              title: 'Old Engineer',
              company: 'Acme',
              description: 'TypeScript',
              jobUrl: 'https://example.com/jobs/1',
              publishedAt: tenDaysAgo,
              scrapedAt: new Date().toISOString(),
            },
          ],
        },
      ],
      { ingest },
      { embed }
    );

    const summary = await orchestrator.run({
      candidateId: 'candidate',
      source: 'jobstreet',
      query: { keyword: 'engineer' },
      freshness: { maxPostingAgeDays: 7, unknownPostingDatePolicy: 'exclude' },
    });

    expect(summary.discovered).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.expiredByAge).toBe(1);
    // Embedding should NOT have been called for stale job
    expect(embed).not.toHaveBeenCalled();
  });
});
