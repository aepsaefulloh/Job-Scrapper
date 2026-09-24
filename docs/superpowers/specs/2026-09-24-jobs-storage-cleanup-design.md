# Job Storage & Scrape Data Cleanup Design

## Overview
Job Scrapper utilizes Supabase PostgreSQL to ingest and store job listings. Raw job records (`jobs_raw`) retain complete HTML/JSON payloads, and normalized records (`jobs`) store descriptions and high-dimensional vector embeddings (`vector(1536)`). Over repeated scraping runs, unmanaged jobs and raw payloads consume significant database disk space.

This feature introduces a safe, two-tier storage cleanup mechanism:
1. **Single Job Deletion**: Individual job deletion from the job list.
2. **Bulk Storage Cleanup**: Safe bulk pruning of all unapplied/unsaved jobs, orphaned `jobs_raw` payloads, and finished `scrape_runs` history, while strictly preserving all saved/applied candidate applications.

---

## 1. Database & Domain Architecture

### Foreign Key Constraints & Cascade Semantics
- `public.jobs.source_payload_id` -> references `public.jobs_raw (id) on delete restrict`.
- `public.job_skills.job_id` -> references `public.jobs (id) on delete cascade`.
- `public.applications.job_id` -> references `public.jobs (id) on delete cascade`.
- `public.application_materials.application_id` -> references `public.applications (id) on delete cascade`.

Because `jobs` references `jobs_raw` with `on delete restrict`, `jobs` rows must be deleted before `jobs_raw` rows.

### Retention & Preservation Rules
- **Preserved Jobs**: Any job referenced in `public.applications` (`job_id = jobs.id` where `candidate_id = auth.uid()`) is preserved. The candidate's application pipeline is never corrupted or deleted during bulk cleanup.
- **Candidate Ownership**: Every delete query strictly scopes to `candidate_id = auth.uid()`. Cross-user deletions are prevented at both the application repository and RLS levels.

---

## 2. Backend Services & Repository Layer

### 2.1 Repository Contract (`backend/src/infrastructure/supabase/job-repository.ts`)
Add two methods to `JobRepository` and `SupabaseJobRepository`:

```typescript
export interface CleanupResult {
  deletedJobsCount: number;
  deletedRawCount: number;
  deletedScrapeRunsCount: number;
  preservedJobsCount: number;
}

export interface JobRepository {
  // ... existing methods
  deleteJob?(candidateId: string, jobId: string): Promise<boolean>;
  cleanupUnsavedJobs?(candidateId: string): Promise<CleanupResult>;
}
```

#### `deleteJob(candidateId: string, jobId: string): Promise<boolean>`
1. Query job by `id` and `candidate_id` to get `source_payload_id`. If not found, return `false`.
2. Delete job from `public.jobs` where `id = jobId` and `candidate_id = candidateId`.
3. If `source_payload_id` is present, check if any remaining job in `public.jobs` references that `source_payload_id`. If count is 0, delete the record from `public.jobs_raw`.
4. Return `true`.

#### `cleanupUnsavedJobs(candidateId: string): Promise<CleanupResult>`
1. Retrieve candidate's active application job IDs:
   ```sql
   SELECT job_id FROM public.applications WHERE candidate_id = :candidateId
   ```
2. Identify target jobs to remove:
   All jobs for this candidate whose `id` is NOT in the applied list.
   Count preserved jobs (`applications` list count).
3. If no jobs to delete, count and delete completed `scrape_runs` and return.
4. Extract `source_payload_id`s from target jobs.
5. Delete target jobs from `public.jobs`. (Child `job_skills` auto-cascade).
6. Delete orphaned `jobs_raw` records for this candidate (those whose `id` is no longer referenced in `public.jobs`).
7. Delete finished scrape runs for this candidate:
   ```sql
   DELETE FROM public.scrape_runs 
   WHERE candidate_id = :candidateId 
     AND status IN ('completed', 'failed', 'partial')
   ```
8. Return `CleanupResult`.

### 2.2 Service Layer (`backend/src/services/job-service.ts`)
Delegate to repository:
```typescript
public delete(candidateId: string, jobId: string): Promise<boolean> {
  return this.repository.deleteJob(candidateId, jobId);
}

public cleanup(candidateId: string): Promise<CleanupResult> {
  return this.repository.cleanupUnsavedJobs(candidateId);
}
```

### 2.3 API Endpoints (`backend/src/app.ts`)

#### `DELETE /jobs/:id`
- **Auth**: Authenticated candidate.
- **Success**: Status `200` with `{ success: true, jobId: string }` or `404` if job not found.
- **Logging**: `job.delete.completed` / `job.delete.failed`.

#### `POST /jobs/cleanup`
- **Auth**: Authenticated candidate.
- **Success**: Status `200` with `CleanupResult`.
- **Logging**: `job.cleanup.completed` / `job.cleanup.failed`.

---

## 3. Frontend Implementation & User Interface

### 3.1 API Client (`frontend/src/lib/api.ts`)
- `deleteJob(id: string): Promise<{ success: boolean; jobId: string }>`
- `cleanupJobs(): Promise<CleanupResult>`

### 3.2 Composable (`frontend/src/composables/useJobs.ts`)
Add:
- `deleteJob(jobId: string)`: Calls `api.deleteJob(jobId)`. Optimistically removes from `jobs.value` and decrements `total.value`.
- `cleanupJobs()`: Calls `api.cleanupJobs()`. Returns the cleanup result and re-fetches the jobs list.

### 3.3 Single Job Deletion (`frontend/src/components/jobs/JobRow.vue`)
- Add a trash button beside the Bookmark/Save button.
- Icon: `Trash2` (lucide-vue-next).
- Interaction:
  - `@click.stop="emit('delete', job)"` (prevents opening detail route).
  - Hover style: `text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1.5 transition-colors`.
  - Tooltip: `"Delete job"`.

### 3.4 Bulk Cleanup UI (`frontend/src/views/JobsView.vue`)
- **Header Action Button**:
  - Located beside the jobs count / filter controls.
  - Button styling: Clean secondary button with icon `Trash2` or `Sparkles` / `Eraser` and label `"Clean Up Storage"` / `"Bersihkan Data"`.
- **Confirmation Modal**:
  - Explains the exact action:
    - Inactive / unapplied jobs will be pruned.
    - Raw scrape payloads (`jobs_raw`) and scrape history will be pruned.
    - Saved applications remain completely untouched.
  - Buttons: `"Batal"` and `"Ya, Bersihkan Data"` (shows spinner when pending).
  - Toast / Banner on completion: shows how many jobs and logs were cleared.

---

## 4. Testing & Verification

### Unit & Integration Tests
1. **Unit Tests (`backend/tests/unit/domain/` or `services/`)**:
   - `job-service.test.ts`: verify `delete` and `cleanup` delegation.
2. **Integration Tests (`backend/tests/integration/api/`)**:
   - `job-cleanup-api.test.ts`:
     - Test `DELETE /api/jobs/:id` deletes single job and cascades properly.
     - Test `POST /api/jobs/cleanup` preserves saved application jobs.
     - Test `POST /api/jobs/cleanup` purges unsaved jobs, orphaned `jobs_raw`, and completed `scrape_runs`.
     - Test cross-candidate isolation (user cannot delete another user's jobs).
3. **Frontend Component Tests (`frontend/src/components/jobs/__tests__/`)**:
   - `JobRow.test.ts`: verify delete button click emits `'delete'`.
   - `JobsView.test.ts`: verify cleanup modal opens and triggers cleanup.
