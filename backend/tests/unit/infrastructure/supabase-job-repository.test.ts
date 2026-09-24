import { describe, expect, it, vi } from 'vitest';
import { SupabaseJobRepository } from '../../../src/infrastructure/supabase/job-repository.js';

describe('SupabaseJobRepository deletion and cleanup', () => {
  it('deletes single job and removes unreferenced raw payload', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseJobRepository(fakeClient);

    // Mock finding job
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: { id: 'job-1', source_payload_id: 'raw-1' },
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock deleting job
    fromMock.mockReturnValueOnce({
      delete: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      }),
    });

    // Mock checking remaining references to raw-1
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          count: 0,
          error: null,
        }),
      }),
    });

    // Mock deleting raw-1
    fromMock.mockReturnValueOnce({
      delete: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      }),
    });

    const deleted = await repo.deleteJob('cand-1', 'job-1');
    expect(deleted).toBe(true);
  });

  it('cleans up unsaved jobs, orphaned raw payloads, and completed scrape runs', async () => {
    const fromMock = vi.fn();
    const fakeClient = { from: fromMock } as any;
    const repo = new SupabaseJobRepository(fakeClient);

    // 1. Fetch applied jobs
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({
          data: [{ job_id: 'job-preserved' }],
          error: null,
        }),
      }),
    });

    // 2. Fetch all jobs for candidate
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({
          data: [
            { id: 'job-preserved', source_payload_id: 'raw-preserved' },
            { id: 'job-to-delete', source_payload_id: 'raw-orphaned' },
          ],
          error: null,
        }),
      }),
    });

    // 3. RLS can accept a DELETE request while deleting zero rows. The result must
    // report actual deleted rows rather than the number selected for deletion.
    fromMock.mockReturnValueOnce({
      delete: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          in: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      }),
    });

    // 4. Fetch remaining jobs to check referenced payload IDs
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({
          data: [{ source_payload_id: 'raw-preserved' }],
          error: null,
        }),
      }),
    });

    // 5. Fetch all raw jobs for candidate
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({
          data: [{ id: 'raw-preserved' }, { id: 'raw-orphaned' }],
          error: null,
        }),
      }),
    });

    // 6. Delete orphaned raw jobs
    fromMock.mockReturnValueOnce({
      delete: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          in: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      }),
    });

    // 7. Fetch finished scrape runs
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          in: vi.fn().mockResolvedValueOnce({
            data: [{ id: 'run-1' }],
            error: null,
          }),
        }),
      }),
    });

    // 8. Delete finished scrape runs
    fromMock.mockReturnValueOnce({
      delete: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          in: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      }),
    });

    const result = await repo.cleanupUnsavedJobs('cand-1');
    expect(result).toEqual({
      deletedJobsCount: 0,
      deletedRawCount: 0,
      deletedScrapeRunsCount: 0,
      preservedJobsCount: 1,
    });
  });
});
