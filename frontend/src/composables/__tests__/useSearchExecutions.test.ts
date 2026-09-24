import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSearchExecutions } from '../useSearchExecutions';
import { apiClient } from '../../lib/api';
import type { SearchExecutionRecord } from '../../types/search-execution';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('useSearchExecutions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleExecution: SearchExecutionRecord = {
    id: 'exec-1',
    candidateId: 'cand-1',
    status: 'completed',
    trigger: 'manual',
    startedAt: '2026-09-24T10:00:00Z',
    finishedAt: '2026-09-24T10:01:00Z',
    preferencesSnapshot: { sources: ['jobstreet'] },
    intentsSnapshot: [{ source: 'jobstreet', keyword: 'Frontend', location: 'Jakarta' }],
    stages: [],
    timeline: [],
    summary: {
      discovered: 12,
      inserted: 8,
      updated: 0,
      duplicates: 4,
      failed: 0,
      filteredOut: 0,
      aiEvaluated: 8,
      aiFailed: 0,
    },
    sources: [
      {
        source: 'jobstreet',
        status: 'completed',
        discovered: 12,
        inserted: 8,
        duplicates: 4,
        failed: 0,
        durationMs: 60000,
      },
    ],
    createdAt: '2026-09-24T10:00:00Z',
  };

  it('fetches search executions with pagination and updates state', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      items: [sampleExecution],
      pagination: { limit: 20, offset: 0, total: 42 },
    });

    const { executions, total, totalPages, page, fetchExecutions, loading } = useSearchExecutions();

    expect(loading.value).toBe(false);
    await fetchExecutions();

    expect(apiClient.get).toHaveBeenCalledWith('/search-runs?limit=20&offset=0');
    expect(executions.value).toHaveLength(1);
    expect(total.value).toBe(42);
    expect(totalPages.value).toBe(3); // ceil(42 / 20) = 3
    expect(page.value).toBe(1);
  });

  it('applies filters and resets to page 1', async () => {
    (apiClient.get as any).mockResolvedValue({
      items: [sampleExecution],
      pagination: { limit: 20, offset: 0, total: 1 },
    });

    const { setFilter, page } = useSearchExecutions();
    page.value = 2;

    await setFilter('status', 'completed');
    expect(page.value).toBe(1);
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('status=completed'));

    await setFilter('source', 'jobstreet');
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('source=jobstreet'));

    await setFilter('trigger', 'manual');
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('trigger=manual'));
  });

  it('navigates between pages using setPage', async () => {
    (apiClient.get as any).mockResolvedValue({
      items: [sampleExecution],
      pagination: { limit: 20, offset: 20, total: 45 },
    });

    const { setPage, page } = useSearchExecutions();
    // Simulate already having total 45
    await setPage(2);

    expect(page.value).toBe(2);
    expect(apiClient.get).toHaveBeenCalledWith('/search-runs?limit=20&offset=20');
  });

  it('handles API errors gracefully and updates error ref', async () => {
    (apiClient.get as any).mockRejectedValueOnce(new Error('Network error'));

    const { fetchExecutions, error, executions } = useSearchExecutions();
    await fetchExecutions();

    expect(error.value).toBe('Network error');
    expect(executions.value).toHaveLength(0);
  });
});
