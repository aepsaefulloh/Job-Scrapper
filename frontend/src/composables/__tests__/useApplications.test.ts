import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useApplications } from '../useApplications';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('useApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches applications with status filters', async () => {
    const mockAppResponse = {
      items: [
        {
          id: 'app-1',
          jobId: 'job-1',
          jobTitle: 'Senior Frontend Engineer',
          companyName: 'Tokopedia',
          location: 'Jakarta',
          status: 'applied',
          notes: 'Submitted resume',
          appliedAt: '2026-09-23T00:00:00.000Z',
          createdAt: '2026-09-23T00:00:00.000Z',
          updatedAt: '2026-09-23T00:00:00.000Z',
        },
      ],
      pagination: { limit: 20, offset: 0, total: 1 },
    };

    (apiClient.get as any).mockResolvedValue(mockAppResponse);

    const { applications, total, fetchApplications } = useApplications();
    await fetchApplications({ status: 'applied' });

    expect(applications.value).toHaveLength(1);
    expect(total.value).toBe(1);
    expect(apiClient.get).toHaveBeenCalledWith('/applications?limit=20&offset=0&status=applied');
  });

  it('creates an application for a job', async () => {
    const newApp = {
      id: 'app-2',
      jobId: 'job-2',
      status: 'saved',
    };
    (apiClient.post as any).mockResolvedValue(newApp);

    const { createApplication } = useApplications();
    const result = await createApplication('job-2', 'saved');

    expect(result).toEqual(newApp);
    expect(apiClient.post).toHaveBeenCalledWith('/applications', {
      jobId: 'job-2',
      status: 'saved',
      notes: undefined,
      appliedAt: undefined,
    });
  });
});
