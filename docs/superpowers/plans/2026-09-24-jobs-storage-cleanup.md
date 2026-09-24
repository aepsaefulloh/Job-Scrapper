# Job Storage & Scrape Data Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement safe, candidate-scoped single-job deletion and bulk storage cleanup to prevent Supabase database disk bloat.

**Architecture:** Extend `JobRepository` and `JobService` with deletion and cleanup capabilities, expose authenticated `DELETE /jobs/:id` and `POST /jobs/cleanup` in Express, and integrate single-job deletion and bulk cleanup confirmation modal in the Vue 3 frontend.

**Tech Stack:** Node.js, TypeScript, Express, Supabase PostgreSQL, Vue 3, Vite, Tailwind CSS, Vitest.

## Global Constraints
- Strictly candidate-scoped via `candidate_id = auth.uid()` across all repository queries.
- Jobs referenced in `public.applications` are strictly preserved during bulk cleanup.
- Due to foreign key `on delete restrict` from `jobs.source_payload_id` to `jobs_raw.id`, `jobs` rows must be deleted before deleting orphaned `jobs_raw` payloads.
- Completed and failed `scrape_runs` are pruned during bulk cleanup; currently active runs (`pending`, `running`) are never touched.

---

### Task 1: Job Repository Deletion & Cleanup Methods

**Files:**
- Modify: `backend/src/infrastructure/supabase/job-repository.ts`
- Test: `backend/tests/unit/infrastructure/supabase-job-repository.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface CleanupResult {
    deletedJobsCount: number;
    deletedRawCount: number;
    deletedScrapeRunsCount: number;
    preservedJobsCount: number;
  }
  ```
  And methods on `JobRepository`:
  - `deleteJob(candidateId: string, jobId: string): Promise<boolean>`
  - `cleanupUnsavedJobs(candidateId: string): Promise<CleanupResult>`

- [ ] **Step 1: Write the failing repository unit test**

Create `backend/tests/unit/infrastructure/supabase-job-repository.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/unit/infrastructure/supabase-job-repository.test.ts`
Expected: FAIL (`repo.deleteJob is not a function`).

- [ ] **Step 3: Implement `deleteJob` and `cleanupUnsavedJobs` in `SupabaseJobRepository`**

Update `backend/src/infrastructure/supabase/job-repository.ts`:
```typescript
export interface CleanupResult {
  deletedJobsCount: number;
  deletedRawCount: number;
  deletedScrapeRunsCount: number;
  preservedJobsCount: number;
}

export interface JobRepository {
  persist(record: JobIngestionRecord): Promise<JobIngestionResult>;
  listJobs?(candidateId: string, query: { limit: number; offset: number; source?: string; company?: string; keyword?: string }): Promise<{ items: unknown[]; total: number }>;
  getJobById?(candidateId: string, jobId: string): Promise<unknown | null>;
  updateJob?(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }): Promise<unknown | null>;
  findJobsMissingEmbedding?(candidateId: string, limit: number): Promise<Array<{ id: string }>>;
  deleteJob?(candidateId: string, jobId: string): Promise<boolean>;
  cleanupUnsavedJobs?(candidateId: string): Promise<CleanupResult>;
}
```

Implement in `SupabaseJobRepository`:
```typescript
  public async deleteJob(candidateId: string, jobId: string): Promise<boolean> {
    const { data: job, error: findError } = await this.client
      .from('jobs')
      .select('id, source_payload_id')
      .eq('candidate_id', candidateId)
      .eq('id', jobId)
      .maybeSingle();

    if (findError) throw new JobPersistenceError('Failed to check job for deletion.');
    if (!job) return false;

    const sourcePayloadId = (job as { source_payload_id?: string }).source_payload_id;

    const { error: deleteError } = await this.client
      .from('jobs')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('id', jobId);

    if (deleteError) throw new JobPersistenceError('Failed to delete job.');

    if (sourcePayloadId) {
      const { count } = await this.client
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('source_payload_id', sourcePayloadId);

      if (count === 0) {
        await this.client
          .from('jobs_raw')
          .delete()
          .eq('candidate_id', candidateId)
          .eq('id', sourcePayloadId);
      }
    }

    return true;
  }

  public async cleanupUnsavedJobs(candidateId: string): Promise<CleanupResult> {
    const { data: applied, error: appError } = await this.client
      .from('applications')
      .select('job_id')
      .eq('candidate_id', candidateId);

    if (appError) throw new JobPersistenceError('Failed to fetch applied jobs.');

    const appliedJobIds = new Set((applied ?? []).map((a: { job_id: string }) => a.job_id));
    const preservedJobsCount = appliedJobIds.size;

    const { data: allJobs, error: jobsError } = await this.client
      .from('jobs')
      .select('id, source_payload_id')
      .eq('candidate_id', candidateId);

    if (jobsError) throw new JobPersistenceError('Failed to fetch jobs for cleanup.');

    const jobsToDelete = (allJobs ?? []).filter((j: { id: string }) => !appliedJobIds.has(j.id));
    const targetJobIds = jobsToDelete.map((j: { id: string }) => j.id);

    let deletedJobsCount = 0;
    if (targetJobIds.length > 0) {
      const { error: delJobsError } = await this.client
        .from('jobs')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', targetJobIds);

      if (delJobsError) throw new JobPersistenceError('Failed to delete unsaved jobs.');
      deletedJobsCount = targetJobIds.length;
    }

    const { data: remainingJobs } = await this.client
      .from('jobs')
      .select('source_payload_id')
      .eq('candidate_id', candidateId);

    const referencedPayloadIds = new Set((remainingJobs ?? []).map((j: { source_payload_id: string }) => j.source_payload_id));

    const { data: allRaw } = await this.client
      .from('jobs_raw')
      .select('id')
      .eq('candidate_id', candidateId);

    const rawToDelete = (allRaw ?? []).filter((r: { id: string }) => !referencedPayloadIds.has(r.id)).map((r: { id: string }) => r.id);

    let deletedRawCount = 0;
    if (rawToDelete.length > 0) {
      const { error: delRawError } = await this.client
        .from('jobs_raw')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', rawToDelete);

      if (!delRawError) deletedRawCount = rawToDelete.length;
    }

    const { data: finishedRuns } = await this.client
      .from('scrape_runs')
      .select('id')
      .eq('candidate_id', candidateId)
      .in('status', ['completed', 'failed', 'partial']);

    let deletedScrapeRunsCount = 0;
    const runIdsToDelete = (finishedRuns ?? []).map((r: { id: string }) => r.id);
    if (runIdsToDelete.length > 0) {
      const { error: delRunsError } = await this.client
        .from('scrape_runs')
        .delete()
        .eq('candidate_id', candidateId)
        .in('id', runIdsToDelete);

      if (!delRunsError) deletedScrapeRunsCount = runIdsToDelete.length;
    }

    return {
      deletedJobsCount,
      deletedRawCount,
      deletedScrapeRunsCount,
      preservedJobsCount,
    };
  }
```

- [ ] **Step 4: Run repository tests to verify they pass**

Run: `bun test backend/tests/unit/infrastructure/supabase-job-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/supabase/job-repository.ts backend/tests/unit/infrastructure/supabase-job-repository.test.ts
git commit -m "feat(backend): add deleteJob and cleanupUnsavedJobs to JobRepository"
```

---

### Task 2: Job Service Layer Updates

**Files:**
- Modify: `backend/src/services/job-service.ts`
- Test: `backend/tests/unit/services/job-service.test.ts`

**Interfaces:**
- Consumes: `JobRepository.deleteJob`, `JobRepository.cleanupUnsavedJobs`
- Produces:
  - `JobService.prototype.delete(candidateId: string, jobId: string): Promise<boolean>`
  - `JobService.prototype.cleanup(candidateId: string): Promise<CleanupResult>`

- [ ] **Step 1: Write the failing unit test for `JobService`**

Create `backend/tests/unit/services/job-service.test.ts`:
```typescript
import { describe, expect, it, vi } from 'vitest';
import { JobService } from '../../../src/services/job-service.js';

describe('JobService', () => {
  it('delegates delete and cleanup to repository', async () => {
    const deleteJob = vi.fn().mockResolvedValue(true);
    const cleanupUnsavedJobs = vi.fn().mockResolvedValue({
      deletedJobsCount: 10,
      deletedRawCount: 10,
      deletedScrapeRunsCount: 2,
      preservedJobsCount: 1,
    });

    const repo = {
      listJobs: vi.fn(),
      getJobById: vi.fn(),
      updateJob: vi.fn(),
      deleteJob,
      cleanupUnsavedJobs,
    } as any;

    const service = new JobService(repo);

    const deleteResult = await service.delete('cand-1', 'job-1');
    expect(deleteResult).toBe(true);
    expect(deleteJob).toHaveBeenCalledWith('cand-1', 'job-1');

    const cleanupResult = await service.cleanup('cand-1');
    expect(cleanupResult.deletedJobsCount).toBe(10);
    expect(cleanupUnsavedJobs).toHaveBeenCalledWith('cand-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/unit/services/job-service.test.ts`
Expected: FAIL (`service.delete is not a function`).

- [ ] **Step 3: Implement `delete` and `cleanup` methods in `JobService`**

Update `backend/src/services/job-service.ts`:
```typescript
import type { JobRepository, CleanupResult } from '../infrastructure/supabase/job-repository.js';

export class JobService {
  public constructor(
    private readonly repository: Required<Pick<JobRepository, 'listJobs' | 'getJobById' | 'updateJob'>> &
      Pick<JobRepository, 'deleteJob' | 'cleanupUnsavedJobs'>
  ) {}

  public list(candidateId: string, query: Parameters<NonNullable<JobRepository['listJobs']>>[1]) {
    return this.repository.listJobs(candidateId, query);
  }

  public detail(candidateId: string, jobId: string) {
    return this.repository.getJobById(candidateId, jobId);
  }

  public update(candidateId: string, jobId: string, patch: { status?: 'active' | 'expired' | 'closed' }) {
    return this.repository.updateJob(candidateId, jobId, patch);
  }

  public delete(candidateId: string, jobId: string): Promise<boolean> {
    if (!this.repository.deleteJob) throw new Error('deleteJob not supported by repository');
    return this.repository.deleteJob(candidateId, jobId);
  }

  public cleanup(candidateId: string): Promise<CleanupResult> {
    if (!this.repository.cleanupUnsavedJobs) throw new Error('cleanupUnsavedJobs not supported by repository');
    return this.repository.cleanupUnsavedJobs(candidateId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/unit/services/job-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/job-service.ts backend/tests/unit/services/job-service.test.ts
git commit -m "feat(backend): add delete and cleanup methods to JobService"
```

---

### Task 3: Backend HTTP API Endpoints (`DELETE /jobs/:id` & `POST /jobs/cleanup`)

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/api/job-cleanup-api.test.ts`

**Interfaces:**
- Consumes: `JobService.delete`, `JobService.cleanup`
- Produces:
  - `DELETE /jobs/:id` (200 `{ success: true, jobId: string }` or 404)
  - `POST /jobs/cleanup` (200 `CleanupResult`)

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/integration/api/job-cleanup-api.test.ts`:
```typescript
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

function app() {
  const jobs = {
    delete: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn().mockResolvedValue({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 2,
    }),
  };

  return {
    app: createApp({
      profileDocumentMaxBytes: 1024,
      authenticate: async (token) => ({ userId: 'candidate-a', accessToken: token }),
      createProfileService: () => ({ upload: async () => ({}) }),
      createJobService: () => jobs as never,
    }),
    jobs,
  };
}

describe('Job Cleanup and Deletion API', () => {
  it('requires authentication for DELETE /jobs/:id and POST /jobs/cleanup', async () => {
    const { app: expressApp } = app();
    await request(expressApp).delete('/jobs/job-1').expect(401);
    await request(expressApp).post('/jobs/cleanup').expect(401);
  });

  it('deletes single job successfully or returns 404', async () => {
    const { app: expressApp, jobs } = app();

    const res = await request(expressApp)
      .delete('/jobs/job-1')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(res.body).toEqual({ success: true, jobId: 'job-1' });
    expect(jobs.delete).toHaveBeenCalledWith('candidate-a', 'job-1');

    jobs.delete.mockResolvedValueOnce(false);
    await request(expressApp)
      .delete('/jobs/job-not-found')
      .set('Authorization', 'Bearer token')
      .expect(404);
  });

  it('executes bulk storage cleanup and returns stats', async () => {
    const { app: expressApp, jobs } = app();

    const res = await request(expressApp)
      .post('/jobs/cleanup')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(res.body).toEqual({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 2,
    });
    expect(jobs.cleanup).toHaveBeenCalledWith('candidate-a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/integration/api/job-cleanup-api.test.ts`
Expected: FAIL (`404 Cannot DELETE /jobs/job-1`).

- [ ] **Step 3: Implement endpoints in `backend/src/app.ts`**

In `backend/src/app.ts`, within the `if (dependencies.createJobService)` block:
```typescript
    router.delete('/jobs/:id', authenticate, async (req, res, next) => {
      try {
        const jobId = String(req.params.id);
        const service = dependencies.createJobService!(res.locals.auth.accessToken);
        const deleted = await service.delete(res.locals.auth.userId, jobId);
        if (!deleted) {
          return void res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job was not found.' } });
        }
        dependencies.logger?.info({ event: 'job.delete.completed', candidateId: res.locals.auth.userId, jobId });
        res.json({ success: true, jobId });
      } catch (e) {
        dependencies.logger?.error({ event: 'job.delete.failed', jobId: String(req.params.id) });
        next(e);
      }
    });

    router.post('/jobs/cleanup', authenticate, async (req, res, next) => {
      try {
        const service = dependencies.createJobService!(res.locals.auth.accessToken);
        const result = await service.cleanup(res.locals.auth.userId);
        dependencies.logger?.info({ event: 'job.cleanup.completed', candidateId: res.locals.auth.userId, result });
        res.json(result);
      } catch (e) {
        dependencies.logger?.error({ event: 'job.cleanup.failed' });
        next(e);
      }
    });
```

- [ ] **Step 4: Run integration test to verify it passes**

Run: `bun test backend/tests/integration/api/job-cleanup-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/tests/integration/api/job-cleanup-api.test.ts
git commit -m "feat(backend): add DELETE /jobs/:id and POST /jobs/cleanup API endpoints"
```

---

### Task 4: Frontend API & Composable Methods

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/composables/useJobs.ts`
- Test: `frontend/src/composables/__tests__/useJobs.test.ts`

**Interfaces:**
- Produces:
  - `api.deleteJob(id: string): Promise<{ success: boolean; jobId: string }>`
  - `api.cleanupJobs(): Promise<CleanupResult>`
  - Composable returns `deleteJob` and `cleanupJobs`

- [ ] **Step 1: Write test for `useJobs` composable cleanup and delete methods**

Create `frontend/src/composables/__tests__/useJobs.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useJobs } from '../useJobs';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  fetchJobs: vi.fn(),
  fetchJobDetail: vi.fn(),
  updateJobStatus: vi.fn(),
  deleteJob: vi.fn(),
  cleanupJobs: vi.fn(),
}));

describe('useJobs delete and cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes job optimistically on deleteJob', async () => {
    vi.mocked(api.deleteJob).mockResolvedValueOnce({ success: true, jobId: 'job-1' });
    const { jobs, total, deleteJob } = useJobs();
    jobs.value = [{ id: 'job-1', title: 'Developer' } as any, { id: 'job-2', title: 'Designer' } as any];
    total.value = 2;

    const ok = await deleteJob('job-1');
    expect(ok).toBe(true);
    expect(jobs.value).toHaveLength(1);
    expect(jobs.value[0].id).toBe('job-2');
    expect(total.value).toBe(1);
  });

  it('calls cleanupJobs and refreshes list', async () => {
    vi.mocked(api.cleanupJobs).mockResolvedValueOnce({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 1,
    });
    vi.mocked(api.fetchJobs).mockResolvedValueOnce({ items: [], pagination: { limit: 20, offset: 0, total: 0 } });

    const { cleanupJobs } = useJobs();
    const result = await cleanupJobs();

    expect(result.deletedJobsCount).toBe(5);
    expect(api.fetchJobs).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd frontend test src/composables/__tests__/useJobs.test.ts`
Expected: FAIL (`deleteJob is not a function`).

- [ ] **Step 3: Implement `deleteJob` & `cleanupJobs` in `api.ts` and `useJobs.ts`**

In `frontend/src/lib/api.ts`:
```typescript
export interface CleanupResult {
  deletedJobsCount: number;
  deletedRawCount: number;
  deletedScrapeRunsCount: number;
  preservedJobsCount: number;
}

export async function deleteJob(id: string): Promise<{ success: boolean; jobId: string }> {
  return apiFetch<{ success: boolean; jobId: string }>(`/jobs/${id}`, {
    method: 'DELETE',
  });
}

export async function cleanupJobs(): Promise<CleanupResult> {
  return apiFetch<CleanupResult>('/jobs/cleanup', {
    method: 'POST',
  });
}
```

In `frontend/src/composables/useJobs.ts`:
```typescript
  async function deleteJob(id: string): Promise<boolean> {
    try {
      await api.deleteJob(id);
      jobs.value = jobs.value.filter((j) => j.id !== id);
      total.value = Math.max(0, total.value - 1);
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete job';
      return false;
    }
  }

  async function cleanupJobs(): Promise<api.CleanupResult> {
    loading.value = true;
    error.value = null;
    try {
      const result = await api.cleanupJobs();
      await fetchJobs();
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cleanup jobs';
      throw err;
    } finally {
      loading.value = false;
    }
  }
```

Export `deleteJob` and `cleanupJobs` from `useJobs()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --cwd frontend test src/composables/__tests__/useJobs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/composables/useJobs.ts frontend/src/composables/__tests__/useJobs.test.ts
git commit -m "feat(frontend): add deleteJob and cleanupJobs to api and useJobs composable"
```

---

### Task 5: JobRow Single Job Delete Action

**Files:**
- Modify: `frontend/src/components/jobs/JobRow.vue`
- Test: `frontend/src/components/jobs/__tests__/JobRow.test.ts`

**Interfaces:**
- Produces:
  - Event `(e: 'delete', job: JobListItem): void`
  - Trash button with `@click.stop="emit('delete', job)"`

- [ ] **Step 1: Write test for `JobRow` delete action**

Create `frontend/src/components/jobs/__tests__/JobRow.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import JobRow from '../JobRow.vue';
import type { JobListItem } from '../../../types/job';

const mockJob: JobListItem = {
  id: 'job-123',
  title: 'Senior Engineer',
  company: 'Tech Corp',
  source: 'jobstreet',
  location: 'Jakarta',
  publishedAt: '2026-09-23T00:00:00.000Z',
  createdAt: '2026-09-23T00:00:00.000Z',
  jobUrl: 'https://example.com/job/123',
};

describe('JobRow.vue', () => {
  it('emits delete event when trash button is clicked', async () => {
    const wrapper = mount(JobRow, {
      props: {
        job: mockJob,
      },
    });

    const deleteBtn = wrapper.find('button[title="Delete job"]');
    expect(deleteBtn.exists()).toBe(true);

    await deleteBtn.trigger('click');
    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')?.[0]).toEqual([mockJob]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd frontend test src/components/jobs/__tests__/JobRow.test.ts`
Expected: FAIL (`deleteBtn.exists() is false`).

- [ ] **Step 3: Update `JobRow.vue` with delete action button**

In `frontend/src/components/jobs/JobRow.vue`:
1. Import `Trash2` from `lucide-vue-next`.
2. Update `defineEmits`:
   ```typescript
   const emit = defineEmits<{
     (e: 'save', job: JobListItem): void;
     (e: 'delete', job: JobListItem): void;
   }>();
   ```
3. Add the delete button right next to the Bookmark button:
   ```html
   <button
     type="button"
     @click.stop="emit('delete', job)"
     title="Delete job"
     class="p-1.5 rounded-lg border border-transparent hover:border-surface-border hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition"
   >
     <Trash2 class="w-4 h-4" />
   </button>
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --cwd frontend test src/components/jobs/__tests__/JobRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/jobs/JobRow.vue frontend/src/components/jobs/__tests__/JobRow.test.ts
git commit -m "feat(frontend): add delete action button to JobRow"
```

---

### Task 6: Storage Cleanup Button & Confirmation Modal in JobsView

**Files:**
- Modify: `frontend/src/views/JobsView.vue`

- [ ] **Step 1: Update `JobsView.vue`**

1. Import `deleteJob` and `cleanupJobs` from `useJobs()`.
2. Add modal state:
   ```typescript
   import { Trash2, Sparkles, AlertTriangle, Loader2 } from 'lucide-vue-next';

   const showCleanupModal = ref(false);
   const cleaningUp = ref(false);
   const cleanupBanner = ref<{ message: string; type: 'success' | 'error' } | null>(null);

   async function handleDeleteJob(job: JobListItem) {
     const ok = await deleteJob(job.id);
     if (ok) {
       cleanupBanner.value = {
         message: `"${job.title}" removed.`,
         type: 'success',
       };
       setTimeout(() => { cleanupBanner.value = null; }, 3000);
     }
   }

   async function handleConfirmCleanup() {
     cleaningUp.value = true;
     try {
       const res = await cleanupJobs();
       showCleanupModal.value = false;
       cleanupBanner.value = {
         message: `Successfully cleaned up ${res.deletedJobsCount} jobs and ${res.deletedScrapeRunsCount} scrape run logs. (${res.preservedJobsCount} applied jobs preserved).`,
         type: 'success',
       };
       setTimeout(() => { cleanupBanner.value = null; }, 5000);
     } catch {
       // handled by composable error
     } finally {
       cleaningUp.value = false;
     }
   }
   ```
3. Add the "Clean Up Storage" button in the header:
   ```html
   <div class="flex items-center gap-3">
     <button
       type="button"
       @click="showCleanupModal = true"
       class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-600 bg-surface border border-surface-border rounded-lg hover:bg-stone-50 hover:text-stone-900 transition shadow-subtle"
       title="Clean up unsaved jobs to save Supabase storage"
     >
       <Trash2 class="w-3.5 h-3.5 text-stone-400" />
       <span>Bersihkan Data</span>
     </button>
     <div class="text-xs text-stone-500 font-medium">
       Showing {{ jobs.length }} of {{ total }} jobs
     </div>
   </div>
   ```
4. Bind `@delete="handleDeleteJob"` on `<JobRow>`.
5. Add the confirmation dialog modal at the bottom of the template:
   - Displays clear explanation that saved applications are safe.
   - Buttons: "Batal" & "Ya, Bersihkan Data" (shows spinner when `cleaningUp`).

- [ ] **Step 2: Run frontend tests & typecheck**

Run:
```bash
bun --cwd frontend test
bun --cwd frontend run typecheck
```
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/JobsView.vue
git commit -m "feat(frontend): add storage cleanup button and modal to JobsView"
```

---

### Task 7: Full Verification Across Monorepo

- [ ] **Step 1: Run all unit and integration tests**

```bash
bun test
```
Expected: All backend and frontend tests pass.

- [ ] **Step 2: Run typecheck across backend and frontend**

```bash
bun run typecheck
bun --cwd frontend run typecheck
```
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run production builds**

```bash
bun run build
bun --cwd frontend run build
```
Expected: Clean build output.

- [ ] **Step 4: Commit and finalize**

```bash
git commit --allow-empty -m "chore: complete job storage cleanup implementation and verification"
```
