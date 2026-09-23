import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useScrapeRuns } from '../useScrapeRuns';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('useScrapeRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleRun = {
    id: 'run-1',
    candidateId: 'cand-1',
    source: 'jobstreet',
    keyword: 'frontend',
    location: 'Jakarta',
    status: 'completed' as const,
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T00:01:00Z',
    discovered: 12,
    inserted: 8,
    updated: 2,
    duplicates: 2,
    failed: 0,
    safeErrorCode: null,
    safeErrorMessage: null,
    trigger: 'manual' as const,
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('fetches latest scrape run', async () => {
    (apiClient.get as any).mockResolvedValue({ latest: sampleRun });
    const { latestRun, fetchLatestRun, isRunning } = useScrapeRuns();

    const result = await fetchLatestRun();
    expect(result).toEqual(sampleRun);
    expect(latestRun.value).toEqual(sampleRun);
    expect(isRunning.value).toBe(false);
  });

  it('fetches recent scrape runs', async () => {
    (apiClient.get as any).mockResolvedValue({ items: [sampleRun] });
    const { recentRuns, fetchRecentRuns } = useScrapeRuns();

    const items = await fetchRecentRuns(5);
    expect(items).toEqual([sampleRun]);
    expect(recentRuns.value).toEqual([sampleRun]);
  });

  it('triggers search successfully and calls POST /search/run', async () => {
    (apiClient.post as any).mockResolvedValue({ status: 'running', runIds: ['run-1'] });
    (apiClient.get as any).mockResolvedValue({ latest: { ...sampleRun, status: 'running' } });

    const { triggerSearch, isRunning, stopPolling } = useScrapeRuns();
    const res = await triggerSearch({ maxPages: 1 });

    expect(apiClient.post).toHaveBeenCalledWith('/search/run', { maxPages: 1 });
    expect(res).toEqual({ status: 'running', runIds: ['run-1'] });
    expect(isRunning.value).toBe(true);

    stopPolling();
  });

  it('handles 409 SEARCH_ALREADY_RUNNING error gracefully', async () => {
    (apiClient.post as any).mockRejectedValue({
      status: 409,
      code: 'SEARCH_ALREADY_RUNNING',
      message: 'Conflict',
    });

    const { triggerSearch, error } = useScrapeRuns();
    const res = await triggerSearch();

    expect(res).toBeNull();
    expect(error.value).toBe('A search is already running for this profile.');
  });

  it('handles 400 SEARCH_PROFILE_NOT_READY error gracefully', async () => {
    (apiClient.post as any).mockRejectedValue({
      status: 400,
      code: 'SEARCH_PROFILE_NOT_READY',
      message: 'Not ready',
    });

    const { triggerSearch, error } = useScrapeRuns();
    const res = await triggerSearch();

    expect(res).toBeNull();
    expect(error.value).toContain('Your job search profile is not ready yet');
  });
});
