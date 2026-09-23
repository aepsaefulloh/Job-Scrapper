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
});
