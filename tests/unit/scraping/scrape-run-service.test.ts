import { describe, expect, it, vi } from 'vitest';
import { ScrapeRunService } from '../../../src/scraping/scrape-run.service.js';

describe('ScrapeRunService', () => {
  it('marks a successful execution completed with its safe summary', async () => {
    const start = vi.fn().mockResolvedValue({ id: 'run-1' }); const finish = vi.fn().mockResolvedValue(undefined);
    const service = new ScrapeRunService({ start, finish });
    await expect(service.execute({ candidateId: 'candidate', source: 'jobstreet' }, async () => ({ source: 'jobstreet', discovered: 2, inserted: 1, updated: 0, duplicates: 1, failed: 0 }))).resolves.toMatchObject({ runId: 'run-1', status: 'completed' });
    expect(finish).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'completed', discovered: 2 }));
  });
  it('marks partial when individual jobs fail', async () => {
    const finish = vi.fn().mockResolvedValue(undefined); const service = new ScrapeRunService({ start: vi.fn().mockResolvedValue({ id: 'run-1' }), finish });
    await service.execute({ candidateId: 'candidate', source: 'jobstreet' }, async () => ({ source: 'jobstreet', discovered: 2, inserted: 1, updated: 0, duplicates: 0, failed: 1 }));
    expect(finish).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'partial' }));
  });
  it('marks failed without retaining the thrown message', async () => {
    const finish = vi.fn().mockResolvedValue(undefined); const service = new ScrapeRunService({ start: vi.fn().mockResolvedValue({ id: 'run-1' }), finish });
    await expect(service.execute({ candidateId: 'candidate', source: 'jobstreet' }, async () => { throw new Error('Bearer secret'); })).rejects.toThrow('Bearer secret');
    expect(finish).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'failed', errorCode: 'SCRAPE_FAILED', errorMessage: 'Scrape execution failed.' }));
  });
});
