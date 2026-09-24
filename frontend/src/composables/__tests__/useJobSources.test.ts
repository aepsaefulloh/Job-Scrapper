import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useJobSources } from '../useJobSources';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('useJobSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with static fallback sources containing jobstreet, loker-id, dealls, and glints', () => {
    const { jobSources, availableSources } = useJobSources();
    expect(jobSources.value.length).toBeGreaterThanOrEqual(4);
    expect(availableSources.value.map((s) => s.id)).toEqual(['jobstreet', 'loker-id', 'dealls', 'glints']);
  });

  it('fetches remote sources and updates reactive state', async () => {
    const mockRemote = [
      { id: 'jobstreet', name: 'Jobstreet', available: true },
      { id: 'loker-id', name: 'Loker.id', available: true },
      { id: 'dealls', name: 'Dealls', available: false },
    ];
    (apiClient.get as any).mockResolvedValueOnce(mockRemote);

    const { jobSources, fetchJobSources } = useJobSources();
    await fetchJobSources();

    expect(apiClient.get).toHaveBeenCalledWith('/job-sources');
    expect(jobSources.value).toEqual(mockRemote);
  });
});
