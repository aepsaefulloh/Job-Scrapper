# Search Run Progress, Metadata, and AI Processing Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide end-to-end visibility for the job search agent by introducing a parent Search Execution model, live progress tracking at `/search-runs/:id`, multi-source status, stage checklists with strict `✦ AI` provenance badges, and refresh-safe polling.

**Architecture:** A `search_executions` table in Supabase PostgreSQL stores parent execution lifecycle, preferences snapshot, real stages, timeline, and aggregate summary. `CandidateSearchService` coordinates stage transitions and child `scrape_runs`. Express exposes `/api/search-runs/:id` and `/api/search-runs`. The Vue 3 frontend redirects immediately upon search initiation, renders `SearchRunDetailView.vue` with real duration and stage metrics, and surfaces run links in `SearchControlCard.vue`.

**Tech Stack:** Node.js, TypeScript, Express, Supabase PostgreSQL, Vue 3, Vite, Tailwind CSS, Lucide Icons, Vitest.

## Global Constraints
- Strictly candidate-scoped via `candidate_id = auth.uid()` across all repository queries and RLS policies.
- No synthetic or fake percentages (e.g. 72%); progress is strictly stage-based.
- Genuine AI operations (vector embedding, matching recommendation) carry the subtle `✦ AI` badge; deterministic operations (URL normalization, scraping, deduplication, date parsing, freshness filter) NEVER carry an AI badge.
- Decoupled failure: scraping success is preserved even if downstream AI matching encounters rate limits or errors.
- Real duration: elapsed duration is derived from `started_at` in realtime, not stored as an artificial timer.

---

### Task 1: Supabase Database Migration for `search_executions`

**Files:**
- Create: `backend/supabase/migrations/20260924120000_search_executions.sql`
- Modify: `backend/src/infrastructure/supabase/database.types.ts`

**Interfaces:**
- Produces: `public.search_executions` table with candidate-isolated RLS policies, linked to `public.scrape_runs.search_execution_id`.

- [ ] **Step 1: Write migration file**

Create `backend/supabase/migrations/20260924120000_search_executions.sql`:
```sql
create table if not exists public.search_executions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  preferences_snapshot jsonb not null default '{}'::jsonb,
  intents_snapshot jsonb not null default '[]'::jsonb,
  stages jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{
    "discovered": 0,
    "inserted": 0,
    "updated": 0,
    "duplicates": 0,
    "failed": 0,
    "filteredOut": 0,
    "aiEvaluated": 0,
    "aiFailed": 0
  }'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.scrape_runs 
  add column if not exists search_execution_id uuid references public.search_executions (id) on delete cascade;

create index if not exists search_executions_candidate_created_idx 
  on public.search_executions (candidate_id, created_at desc);

create index if not exists scrape_runs_search_execution_id_idx 
  on public.scrape_runs (search_execution_id);

grant select, insert, update, delete on public.search_executions to authenticated;
alter table public.search_executions enable row level security;

create policy "Candidates can read their own search executions"
  on public.search_executions for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own search executions"
  on public.search_executions for insert to authenticated
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can update their own search executions"
  on public.search_executions for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

create policy "Candidates can delete their own search executions"
  on public.search_executions for delete to authenticated
  using ((select auth.uid()) = candidate_id);
```

- [ ] **Step 2: Apply migration to remote Supabase via MCP tool**

Execute the SQL using Supabase MCP `execute_sql`.
Verify that table `search_executions` exists and RLS is enabled.

- [ ] **Step 3: Update `database.types.ts`**

Update `backend/src/infrastructure/supabase/database.types.ts` to include table definitions for `search_executions` and column `search_execution_id` on `scrape_runs`.

- [ ] **Step 4: Commit**

```bash
git add backend/supabase/migrations/20260924120000_search_executions.sql backend/src/infrastructure/supabase/database.types.ts
git commit -m "feat(backend): add search_executions table migration and database types"
```

---

### Task 2: Search Execution Repository & Domain Model

**Files:**
- Create: `backend/src/search/search-execution.repository.ts`
- Test: `backend/tests/unit/search/search-execution-repository.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SearchExecutionRecord {
    id: string;
    candidateId: string;
    status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
    trigger: 'manual' | 'scheduled';
    startedAt: string;
    finishedAt: string | null;
    preferencesSnapshot: Record<string, unknown>;
    intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
    stages: Array<{
      id: string;
      name: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      isAi?: boolean;
      startedAt?: string;
      finishedAt?: string;
      details?: string;
    }>;
    timeline: Array<{
      timestamp: string;
      message: string;
      isAi?: boolean;
      type?: 'info' | 'success' | 'warning' | 'error';
    }>;
    summary: {
      discovered: number;
      inserted: number;
      updated: number;
      duplicates: number;
      failed: number;
      filteredOut: number;
      aiEvaluated: number;
      aiFailed: number;
    };
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt: string;
    sources?: Array<{
      source: string;
      status: string;
      discovered: number;
      inserted: number;
      duplicates: number;
      failed: number;
      durationMs?: number;
      error?: string | null;
    }>;
  }
  ```

- [ ] **Step 1: Write the failing unit test for `SearchExecutionRepository`**

Create `backend/tests/unit/search/search-execution-repository.test.ts` testing `create`, `getById` (with joined child scrape runs as sources), `updateStage`, `appendTimeline`, `finish`, and `list`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/unit/search/search-execution-repository.test.ts`
Expected: FAIL (`cannot find module`).

- [ ] **Step 3: Implement `SupabaseSearchExecutionRepository`**

Create `backend/src/search/search-execution.repository.ts` implementing `SearchExecutionRepository`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/unit/search/search-execution-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/search/search-execution.repository.ts backend/tests/unit/search/search-execution-repository.test.ts
git commit -m "feat(backend): add SupabaseSearchExecutionRepository"
```

---

### Task 3: Candidate Search Service Parent Execution Orchestration

**Files:**
- Modify: `backend/src/search/candidate-search.service.ts`
- Test: `backend/tests/unit/search/candidate-search-execution.test.ts`

**Interfaces:**
- Consumes: `SearchExecutionRepository`
- Produces:
  - `runManualSearch` creates parent `search_execution`, records initial stages, returns `{ id: execution.id, status: 'running', ... }`.
  - Background execution updates stages (`scrape:source`, `normalization`, `freshness`, `ai_matching`, `finalizing`), appends timeline events, and isolates AI failures.

- [ ] **Step 1: Write the failing unit test for parent execution orchestration**

Create `backend/tests/unit/search/candidate-search-execution.test.ts` verifying:
1. `runManualSearch` creates parent execution and links child `scrape_runs`.
2. Multi-source execution tracks separate sources and sets `partial` if one source fails.
3. Downstream AI matching error records `aiFailed` but preserves successful scrape status.
4. Finished execution sets `finished_at` and stores aggregate summary.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/unit/search/candidate-search-execution.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `CandidateSearchService` to inject and orchestrate `SearchExecutionRepository`**

Update `backend/src/search/candidate-search.service.ts` with parent execution lifecycle, progressive stage updates, and decoupled AI failure handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/unit/search/candidate-search-execution.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/search/candidate-search.service.ts backend/tests/unit/search/candidate-search-execution.test.ts
git commit -m "feat(backend): integrate parent search execution orchestration in CandidateSearchService"
```

---

### Task 4: HTTP API Endpoints (`POST /api/search/run`, `GET /api/search-runs/:id`, `GET /api/search-runs`)

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/api/search-runs-api.test.ts`

**Interfaces:**
- Produces:
  - `POST /search/run` -> `202 Accepted` `{ id: string, status: 'running', runIds: string[], ... }`
  - `GET /search-runs/:id` -> `200 OK` `SearchExecutionRecord` or 404
  - `GET /search-runs` -> `200 OK` `{ items: SearchExecutionRecord[] }`

- [ ] **Step 1: Write failing integration test for search runs endpoints**

Create `backend/tests/integration/api/search-runs-api.test.ts` testing auth requirement, retrieving run detail, and listing recent runs.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/integration/api/search-runs-api.test.ts`
Expected: FAIL (`404 Cannot GET /search-runs/:id`).

- [ ] **Step 3: Implement routes in `backend/src/app.ts`**

Register `createSearchExecutionService` / repository in dependencies and add `GET /search-runs/:id` and `GET /search-runs`. Update `POST /search/run` handler.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/integration/api/search-runs-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/tests/integration/api/search-runs-api.test.ts
git commit -m "feat(backend): add GET /search-runs/:id and GET /search-runs API endpoints"
```

---

### Task 5: Frontend Types, API Client & `useSearchExecution` Composable

**Files:**
- Create: `frontend/src/types/search-execution.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/composables/useSearchExecution.ts`
- Test: `frontend/src/composables/__tests__/useSearchExecution.test.ts`

**Interfaces:**
- Produces:
  - `apiClient.get<SearchExecutionDetail>('/search-runs/' + id)`
  - `useSearchExecution(id)` with reactive `execution`, `loading`, `error`, `elapsedDuration`, `startPolling()`, `stopPolling()`.

- [ ] **Step 1: Create frontend types**

Create `frontend/src/types/search-execution.ts`.

- [ ] **Step 2: Write failing unit test for `useSearchExecution`**

Create `frontend/src/composables/__tests__/useSearchExecution.test.ts` testing initial fetch, live elapsed duration calculation, polling while running, and termination on `completed` or `failed`.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun --cwd frontend test src/composables/__tests__/useSearchExecution.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `useSearchExecution.ts` and update `api.ts`**

Implement composable with clean interval lifecycle and refresh recovery.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --cwd frontend test src/composables/__tests__/useSearchExecution.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/search-execution.ts frontend/src/lib/api.ts frontend/src/composables/useSearchExecution.ts frontend/src/composables/__tests__/useSearchExecution.test.ts
git commit -m "feat(frontend): add SearchExecution types, api client, and useSearchExecution composable"
```

---

### Task 6: Frontend Route & `SearchRunDetailView.vue` Implementation

**Files:**
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/src/views/SearchRunDetailView.vue`
- Test: `frontend/src/views/__tests__/SearchRunDetailView.test.ts`

**Interfaces:**
- Produces: Route `/search-runs/:id` rendering:
  - Header with Back to Jobs and Main Status Badge
  - Live duration / completed duration
  - Multi-source cards (Jobstreet vs Loker.id status and discovered/new counts)
  - Search Settings & Intent tags
  - Real stage progress checklist with `✦ AI` provenance badge
  - Summary metrics
  - Run timeline
  - Completion actions

- [ ] **Step 1: Write test for `SearchRunDetailView.vue`**

Create `frontend/src/views/__tests__/SearchRunDetailView.test.ts` testing rendering of status, source cards, stages checklist, `✦ AI` badge on AI matching, and completion buttons.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd frontend test src/views/__tests__/SearchRunDetailView.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `SearchRunDetailView.vue` and add route to `router/index.ts`**

Build component following JobToolkit editorial styling rules (restrained, compact, clear hierarchy, no glowing cards).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --cwd frontend test src/views/__tests__/SearchRunDetailView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/index.ts frontend/src/views/SearchRunDetailView.vue frontend/src/views/__tests__/SearchRunDetailView.test.ts
git commit -m "feat(frontend): implement SearchRunDetailView component and /search-runs/:id route"
```

---

### Task 7: Update `SearchControlCard.vue` (Redirect & Recent Searches Link)

**Files:**
- Modify: `frontend/src/components/jobs/SearchControlCard.vue`
- Test: `frontend/src/components/jobs/__tests__/SearchControlCard.test.ts`

- [ ] **Step 1: Update unit test in `SearchControlCard.test.ts`**

Add tests verifying:
1. Clicking **Search Jobs Now** redirects user to `/search-runs/:id`.
2. Recent Searches list displays links to `/search-runs/:id`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd frontend test src/components/jobs/__tests__/SearchControlCard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `SearchControlCard.vue`**

Wire `router.push('/search-runs/' + res.id)` upon search trigger and add `"View Run →"` links in Recent Searches.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --cwd frontend test src/components/jobs/__tests__/SearchControlCard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/jobs/SearchControlCard.vue frontend/src/components/jobs/__tests__/SearchControlCard.test.ts
git commit -m "feat(frontend): redirect to /search-runs/:id on search trigger and add run links in Recent Searches"
```

---

### Task 8: Full Verification Across Monorepo

- [ ] **Step 1: Run all unit and integration tests**

```bash
bun test (in backend)
bun run test (in frontend)
```
Expected: All backend and frontend tests pass.

- [ ] **Step 2: Run typecheck across backend and frontend**

```bash
bun run typecheck (in backend)
bun run typecheck (in frontend)
```
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run production builds**

```bash
bun run build (in backend)
bun run build (in frontend)
```
Expected: Clean build output.

- [ ] **Step 4: Commit and finalize**

```bash
git commit --allow-empty -m "chore: complete search run progress and AI visibility feature"
```
