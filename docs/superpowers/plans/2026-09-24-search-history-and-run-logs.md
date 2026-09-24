# Search History & Run Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, persistent, user-facing Search History page at `/search-runs` with bounded pagination, filters (status, source, trigger, date range), compact editorial cards/rows, AI provenance indicators, and navigation links.

**Architecture:** Extend backend repository and API (`GET /api/search-runs`) with candidate-scoped filtering, pagination (`limit`, `offset`, `total`), and child scrape-runs hydration. In frontend, build `useSearchExecutions` composable, `SearchHistoryView.vue` with JobToolkit typography/aesthetics, register route `/search-runs`, and integrate subtle navigation entries in Sidebar and SearchControlCard.

**Tech Stack:** Node.js, TypeScript strict mode, Express, Supabase PostgreSQL, Vue 3, Vite, Tailwind CSS, Lucide icons, Vitest, Supertest.

## Global Constraints

- Candidate-scoped isolation: every query must enforce `candidate_id = auth.uid()`.
- Strict AI provenance: only display `✦ AI evaluated` when genuine AI evaluation occurred (e.g. `summary.aiEvaluated > 0`), never for deterministic operations.
- Compact, restrained design: editorial layout matching JobToolkit (no noisy charts or fake percentages).
- Terminal logs remain developer-only: history page displays user-facing metrics, statuses, and safe error messages only.
- Bounded pagination: default 20 runs per page, max 100.
- Running executions must be displayed with live link to resume polling on `/search-runs/:id`.

---

### Task 1: Search Execution Repository Query Filtering & Pagination

**Files:**
- Modify: `backend/src/search/search-execution.repository.ts`
- Test: `backend/tests/unit/search/search-execution-repository.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SearchExecutionListOptions {
    limit?: number;
    offset?: number;
    status?: 'running' | 'completed' | 'partial' | 'failed';
    source?: string;
    trigger?: 'manual' | 'scheduled';
    from?: string;
    to?: string;
  }

  export interface SearchExecutionListResult {
    items: SearchExecutionRecord[];
    total: number;
  }
  ```
  `SearchExecutionRepository.list(candidateId: string, options?: SearchExecutionListOptions): Promise<SearchExecutionListResult>`

- [ ] **Step 1: Write unit test in search-execution-repository.test.ts for filtering and pagination**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement list with filtering, pagination, and child scrape-runs hydration in SupabaseSearchExecutionRepository**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Backend API Endpoint: GET /api/search-runs Pagination & Filters

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/api/search-runs-api.test.ts`

**Interfaces:**
- Consumes: `SearchExecutionRepository.list(candidateId, options)`
- Produces: `GET /api/search-runs?limit=20&offset=0&status=...&source=...&trigger=...&from=...&to=...`
  Response:
  ```json
  {
    "items": [...],
    "pagination": { "limit": 20, "offset": 0, "total": 42 }
  }
  ```

- [ ] **Step 1: Add integration tests in search-runs-api.test.ts for filters, pagination, and total count**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update GET /search-runs in backend/src/app.ts with query parsing and pagination response**
- [ ] **Step 4: Run integration test to verify it passes**
- [ ] **Step 5: Commit Task 2**

---

### Task 3: Frontend Types & useSearchExecutions Composable

**Files:**
- Modify: `frontend/src/types/search-execution.ts`
- Create: `frontend/src/composables/useSearchExecutions.ts`
- Create: `frontend/src/composables/__tests__/useSearchExecutions.test.ts`

**Interfaces:**
- Produces:
  `useSearchExecutions()` exposing `executions`, `total`, `loading`, `error`, `filters`, `page`, `pageSize`, `totalPages`, `fetchExecutions`, `setFilter`, `setPage`.

- [ ] **Step 1: Write composable unit tests in useSearchExecutions.test.ts**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update search-execution.ts types and implement useSearchExecutions composable**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Frontend SearchHistoryView.vue Component & Route

**Files:**
- Create: `frontend/src/views/SearchHistoryView.vue`
- Create: `frontend/src/views/__tests__/SearchHistoryView.test.ts`
- Modify: `frontend/src/router/index.ts`

**Interfaces:**
- Route: `/search-runs` -> `SearchHistoryView.vue`
- Displays:
  - Header with title "Search History" and subtitle.
  - Filter bar (status, source, trigger, date range).
  - Compact history list items:
    - Status badge (running, completed, partial, failed).
    - Trigger & timestamp (`Manual · Today 10:31`).
    - Source breakdown summary (`Jobstreet + Loker.id`).
    - Locations & posting age snapshot tags.
    - Counters: discovered, +new, duplicates, AI evaluated.
    - Subtle AI indicator: `✦ AI evaluated`.
    - Elapsed duration.
    - Safe error summary if partial or failed.
    - "View Run →" link (or "View Live Progress →" for running).
  - Bounded pagination controls (Previous / Next / page indicator).
  - Empty state when no runs match.

- [ ] **Step 1: Write component tests for SearchHistoryView in SearchHistoryView.test.ts**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Create SearchHistoryView.vue and register /search-runs route in router/index.ts**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 4**

---

### Task 5: Navigation Integration (Sidebar & SearchControlCard)

**Files:**
- Modify: `frontend/src/components/navigation/Sidebar.vue`
- Modify: `frontend/src/components/jobs/SearchControlCard.vue`
- Test: `frontend/src/components/jobs/__tests__/SearchControlCard.test.ts`

**Interfaces:**
- Sidebar nav: Add `Search History` link (`/search-runs`, `History` icon).
- SearchControlCard: Add "View all history →" link to `/search-runs` in Recent Searches section.

- [ ] **Step 1: Update SearchControlCard.vue to include "View all history →" linking to /search-runs**
- [ ] **Step 2: Update Sidebar.vue to include Search History navigation item**
- [ ] **Step 3: Run existing frontend tests to verify no regressions**
- [ ] **Step 4: Commit Task 5**

---

### Task 6: Full Verification Across Monorepo

**Files:**
- Full workspace check

- [ ] **Step 1: Run all backend tests (`bun test`)**
- [ ] **Step 2: Run backend typecheck (`bun run typecheck`) and build (`bun run build`)**
- [ ] **Step 3: Run all frontend tests (`bun run test`)**
- [ ] **Step 4: Run frontend typecheck (`bun run typecheck`) and build (`bun run build`)**
- [ ] **Step 5: Check verification-before-completion and integrate to main**
