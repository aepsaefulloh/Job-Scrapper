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

  it('delegates list queries and clamps limit within safe bounds', async () => {
    const list = vi.fn().mockResolvedValue([]);
    const service = new ScrapeRunService({ start: vi.fn(), finish: vi.fn(), list });

    await service.list('cand-1', 100);
    expect(list).toHaveBeenCalledWith('cand-1', 50);

    await service.list('cand-1', 5);
    expect(list).toHaveBeenCalledWith('cand-1', 5);
  });

  it('delegates getLatest, getById, and hasAnyActiveRun', async () => {
    const sampleRecord = {
      id: 'run-123',
      candidateId: 'cand-1',
      source: 'jobstreet',
      keyword: 'frontend',
      location: null,
      status: 'completed' as const,
      startedAt: '2026-01-01T00:00:00Z',
      finishedAt: '2026-01-01T00:01:00Z',
      discovered: 5,
      inserted: 3,
      updated: 0,
      duplicates: 2,
      failed: 0,
      safeErrorCode: null,
      safeErrorMessage: null,
      trigger: 'manual' as const,
      createdAt: '2026-01-01T00:00:00Z',
    };

    const getLatest = vi.fn().mockResolvedValue(sampleRecord);
    const getById = vi.fn().mockResolvedValue(sampleRecord);
    const hasAnyActiveRun = vi.fn().mockResolvedValue(true);

    const service = new ScrapeRunService({
      start: vi.fn(),
      finish: vi.fn(),
      getLatest,
      getById,
      hasAnyActiveRun,
    });

    await expect(service.getLatest('cand-1')).resolves.toEqual(sampleRecord);
    expect(getLatest).toHaveBeenCalledWith('cand-1');

    await expect(service.getById('cand-1', 'run-123')).resolves.toEqual(sampleRecord);
    expect(getById).toHaveBeenCalledWith('cand-1', 'run-123');

    await expect(service.hasAnyActiveRun('cand-1')).resolves.toBe(true);
    expect(hasAnyActiveRun).toHaveBeenCalledWith('cand-1');
  });
});

