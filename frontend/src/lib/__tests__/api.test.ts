import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiClient, ApiClientError } from '../api';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer token when token provider returns a token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ApiClient({
      baseUrl: '/api',
      getToken: async () => 'test-bearer-token',
    });

    const result = await client.get<{ data: string }>('/jobs');

    expect(result).toEqual({ data: 'ok' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/jobs');
    expect(options.headers['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('throws ApiClientError with code and message on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job was not found.',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ApiClient({
      baseUrl: '/api',
      getToken: async () => null,
    });

    await expect(client.get('/jobs/missing-id')).rejects.toThrowError(
      'Job was not found.'
    );
  });
});
