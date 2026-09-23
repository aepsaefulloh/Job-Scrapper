import { describe, expect, it, vi } from 'vitest';
import { buildSearchIdentity, normalizeScheduledSearch, ScheduledScrapeTask } from '../../../src/scheduler/scheduled-scrape-task.js';

describe('scheduled scrape task', () => {
  it('normalizes equivalent search identities deterministically', () => {
    expect(buildSearchIdentity({ source: 'JobStreet', keyword: ' Backend   Engineer ', location: 'Indonesia' })).toBe(buildSearchIdentity({ source: 'jobstreet', keyword: 'backend engineer', location: ' indonesia ' }));
    expect(normalizeScheduledSearch({ source: 'JobStreet', keyword: ' Backend   Engineer ', location: 'Indonesia', maxPages: 3 })).toEqual({ source: 'jobstreet', keyword: 'backend engineer', location: 'indonesia', maxPages: 3 });
  });

  it('runs when the same search is not active and forwards normalized config', async () => {
    const execute = vi.fn().mockResolvedValue({ runId: 'run-1', status: 'completed' });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const task = new ScheduledScrapeTask({ hasActiveRun: vi.fn().mockResolvedValue(false) }, execute, logger);
    await expect(task.run('candidate', { source: 'JobStreet', keyword: ' Backend Engineer ', location: 'Indonesia', maxPages: 2 })).resolves.toMatchObject({ status: 'completed' });
    expect(execute).toHaveBeenCalledWith('candidate', { source: 'jobstreet', keyword: 'backend engineer', location: 'indonesia', maxPages: 2 });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'scheduler.search.started' }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'scheduler.search.completed', result: 'completed' }));
  });

  it('skips an active same-search run and logs ACTIVE_RUN', async () => {
    const execute = vi.fn(); const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const task = new ScheduledScrapeTask({ hasActiveRun: vi.fn().mockResolvedValue(true) }, execute, logger);
    await expect(task.run('candidate', { source: 'jobstreet', keyword: 'backend engineer' })).resolves.toEqual({ status: 'skipped', reason: 'ACTIVE_RUN' });
    expect(execute).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'scheduler.search.skipped', reason: 'ACTIVE_RUN' }));
  });

  it('does not let an active different search block this search', async () => {
    const execute = vi.fn().mockResolvedValue({ status: 'completed' });
    const hasActiveRun = vi.fn(async (_candidateId, search) => search.keyword === 'frontend engineer');
    const task = new ScheduledScrapeTask({ hasActiveRun }, execute, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await task.run('candidate', { source: 'jobstreet', keyword: 'backend engineer' });

    expect(execute).toHaveBeenCalledOnce();
  });

  it('reserves an identity before the asynchronous guard resolves', async () => {
    let releaseGuard!: () => void;
    const guardPending = new Promise<void>((resolve) => { releaseGuard = resolve; });
    const hasActiveRun = vi.fn(async () => { await guardPending; return false; });
    const execute = vi.fn().mockResolvedValue({ status: 'completed' });
    const task = new ScheduledScrapeTask({ hasActiveRun }, execute, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    const first = task.run('candidate', { source: 'jobstreet', keyword: 'backend engineer' });
    const second = task.run('candidate', { source: 'jobstreet', keyword: 'backend engineer' });
    releaseGuard();

    await expect(second).resolves.toEqual({ status: 'skipped', reason: 'ACTIVE_RUN' });
    await first;
    expect(execute).toHaveBeenCalledOnce();
  });

  it('logs only a safe error code when scheduled execution fails', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const task = new ScheduledScrapeTask(
      { hasActiveRun: vi.fn().mockResolvedValue(false) },
      vi.fn().mockRejectedValue(new Error('Authorization: Bearer secret-token')),
      logger
    );

    await expect(task.run('candidate', { source: 'jobstreet', keyword: 'backend engineer' })).rejects.toThrow();

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).toContain('SCHEDULED_SCRAPE_FAILED');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('Authorization');
  });
});
