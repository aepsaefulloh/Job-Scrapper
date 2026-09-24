import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useSearchExecution } from '../useSearchExecution';
import { apiClient } from '../../lib/api';
import type { SearchExecutionRecord } from '../../types/search-execution';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('useSearchExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleExecution: SearchExecutionRecord = {
    id: 'exec-123',
    candidateId: 'cand-1',
    status: 'running',
    trigger: 'manual',
    startedAt: new Date(Date.now() - 30000).toISOString(),
    finishedAt: null,
    preferencesSnapshot: { sources: ['jobstreet'] },
    intentsSnapshot: [{ source: 'jobstreet', keyword: 'Frontend', location: 'Jakarta' }],
    stages: [
      { id: 'query_expansion', name: 'Query Expansion', status: 'completed' },
      { id: 'scraping', name: 'Scraping Sources', status: 'running' },
    ],
    timeline: [
      { timestamp: new Date(Date.now() - 30000).toISOString(), message: 'Started', type: 'info' },
    ],
    summary: {
      discovered: 5,
      inserted: 3,
      updated: 0,
      duplicates: 2,
      failed: 0,
      filteredOut: 0,
      aiEvaluated: 0,
      aiFailed: 0,
    },
    sources: [
      {
        source: 'jobstreet',
        status: 'running',
        discovered: 5,
        inserted: 3,
        duplicates: 2,
        failed: 0,
      },
    ],
    createdAt: new Date(Date.now() - 30000).toISOString(),
  };

  it('fetches search execution details by ID', async () => {
    (apiClient.get as any).mockResolvedValue(sampleExecution);
    const { execution, fetchExecution, isRunning } = useSearchExecution();

    const result = await fetchExecution('exec-123');
    expect(apiClient.get).toHaveBeenCalledWith('/search-runs/exec-123');
    expect(result).toEqual(sampleExecution);
    expect(execution.value).toEqual(sampleExecution);
    expect(isRunning.value).toBe(true);
  });

  it('computes elapsed seconds based on startedAt and finishedAt', async () => {
    const started = new Date('2026-09-24T10:00:00Z');
    const finished = new Date('2026-09-24T10:01:15Z');
    const completedExecution: SearchExecutionRecord = {
      ...sampleExecution,
      status: 'completed',
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    };
    (apiClient.get as any).mockResolvedValue(completedExecution);
    const { fetchExecution, elapsedSeconds, formatDuration } = useSearchExecution();

    await fetchExecution('exec-123');
    expect(elapsedSeconds.value).toBe(75);
    expect(formatDuration(75)).toBe('1m 15s');
  });

  it('polls periodically and stops when terminal status is reached', async () => {
    (apiClient.get as any)
      .mockResolvedValueOnce(sampleExecution)
      .mockResolvedValueOnce({
        ...sampleExecution,
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });

    const { execution, startPolling, stopPolling, onExecutionCompleted, isRunning } = useSearchExecution();
    const completedCallback = vi.fn();
    onExecutionCompleted(completedCallback);

    await startPolling('exec-123', 1000);
    expect(isRunning.value).toBe(true);

    // Fast forward timer for poll interval
    await vi.advanceTimersByTimeAsync(1000);

    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(execution.value?.status).toBe('completed');
    expect(isRunning.value).toBe(false);
    expect(completedCallback).toHaveBeenCalledTimes(1);

    stopPolling();
  });

  it('handles error when execution is not found', async () => {
    (apiClient.get as any).mockRejectedValue({
      status: 404,
      message: 'Search execution was not found.',
    });

    const { fetchExecution, error, execution } = useSearchExecution();
    const res = await fetchExecution('non-existent');

    expect(res).toBeNull();
    expect(execution.value).toBeNull();
    expect(error.value).toBe('Search execution was not found.');
  });
});
