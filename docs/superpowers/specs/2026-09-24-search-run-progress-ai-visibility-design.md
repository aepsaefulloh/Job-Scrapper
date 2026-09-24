# Search Run Progress, Metadata, and AI Processing Visibility Design

## Overview
When a candidate triggers **Search Jobs Now**, the job discovery agent generates search intents across configured sources (Jobstreet, Loker.id), performs web scraping, normalizes listings, filters by freshness and eligibility, and triggers AI vector embedding and matching recommendations.

This feature provides operational transparency by introducing:
1. A parent **Search Execution** model (`search_executions`) grouping multi-source scrape runs under one user-initiated search action.
2. Immediate redirect to a dedicated live tracking page `/search-runs/:id`.
3. Real stage-based progress tracking (no synthetic percentages).
4. Multi-source progress visibility (Jobstreet vs Loker.id status and counts).
5. Safe search metadata & preferences snapshot persistence.
6. Clear AI provenance labeling (`✦ AI` on genuine AI operations; zero AI badges on deterministic operations).
7. Decoupled AI failure handling (scraping success is preserved even if AI evaluation fails).
8. Persistent historical detail view with refresh recovery and completion action routing.

---

## 1. Database Schema & Migration

### 1.1 `search_executions` Table
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

-- Link child scrape_runs to search_executions
alter table public.scrape_runs 
  add column if not exists search_execution_id uuid references public.search_executions (id) on delete cascade;

create index if not exists search_executions_candidate_created_idx 
  on public.search_executions (candidate_id, created_at desc);

create index if not exists scrape_runs_search_execution_id_idx 
  on public.scrape_runs (search_execution_id);

-- RLS: Strict candidate ownership
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

---

## 2. Backend Architecture

### 2.1 Repository & Domain Model (`backend/src/search/search-execution.repository.ts`)
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

export interface SearchExecutionRepository {
  create(input: {
    candidateId: string;
    trigger: 'manual' | 'scheduled';
    preferencesSnapshot: Record<string, unknown>;
    intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
    initialStages: SearchExecutionRecord['stages'];
  }): Promise<SearchExecutionRecord>;

  getById(candidateId: string, id: string): Promise<SearchExecutionRecord | null>;
  list(candidateId: string, limit?: number): Promise<SearchExecutionRecord[]>;
  update(candidateId: string, id: string, patch: Partial<SearchExecutionRecord>): Promise<void>;
  appendTimeline(candidateId: string, id: string, event: { message: string; isAi?: boolean; type?: 'info' | 'success' | 'warning' | 'error' }): Promise<void>;
  updateStage(candidateId: string, id: string, stageId: string, status: 'running' | 'completed' | 'failed', details?: string): Promise<void>;
  finish(candidateId: string, id: string, result: {
    status: 'completed' | 'partial' | 'failed';
    summary: SearchExecutionRecord['summary'];
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void>;
}
```

### 2.2 Execution Orchestration (`backend/src/search/candidate-search.service.ts`)
1. `runManualSearch(candidateId, options)`:
   - Derives search profile and retrieves preferences.
   - Plans `JobSearchIntent[]`.
   - Creates parent `search_execution` with initial stages:
     - `initialized`: completed
     - `scrape:jobstreet`: pending (if in sources)
     - `scrape:loker-id`: pending (if in sources)
     - `normalization`: pending
     - `freshness`: pending
     - `ai_matching`: pending (`isAi: true`)
     - `finalizing`: pending
   - Creates child `scrape_runs` linked to `search_execution_id`.
   - Returns `{ id: execution.id, status: 'running', runIds: [...] }`.
   - Launches asynchronous background execution:
     - As each source starts/finishes: updates stages, appends timeline events, updates scrape run.
     - As normalization & freshness run: updates stages.
     - As embeddings/matching run: updates `ai_matching` stage. If AI fails, records `aiFailed` without failing the scrape result.
     - Determines overall execution status:
       - `failed` if all sources fail.
       - `partial` if some sources fail or AI matching fails.
       - `completed` if all enabled sources succeed.
     - Sets `finished_at` and stores aggregate summary.

### 2.3 HTTP API Endpoints (`backend/src/app.ts`)
- `POST /api/search/run`:
  - Returns `202 Accepted` with `{ id: string, status: 'running', runIds: string[], ... }`.
- `GET /api/search-runs/:id`:
  - Returns complete `SearchExecutionRecord` with child sources and stages.
  - Requires candidate bearer auth (`auth.uid() = candidate_id`).
- `GET /api/search-runs`:
  - Returns list of recent search executions for candidate.

---

## 3. Frontend Architecture & UX

### 3.1 Routing (`frontend/src/router/index.ts`)
Add route:
```typescript
{
  path: '/search-runs/:id',
  name: 'search-run-detail',
  component: () => import('../views/SearchRunDetailView.vue'),
  meta: { requiresAuth: true }
}
```

### 3.2 Action Flow from `SearchControlCard.vue`
- When clicking **Search Jobs Now**:
  ```typescript
  const res = await triggerSearch(); // calls POST /api/search/run
  if (res?.id) {
    router.push(`/search-runs/${res.id}`);
  }
  ```
- Recent Searches list links to `/search-runs/:id`.

### 3.3 Tracking Page (`frontend/src/views/SearchRunDetailView.vue`)
- **Header**:
  - `← Back to Jobs` link (`/jobs`).
  - Title: `"Job Search Progress"`.
  - Main status badge: `Preparing`, `Searching`, `Completed`, `Partial`, `Failed`.
  - Timer: Live elapsed duration during execution (`startedAt` -> `Date.now()`); fixed duration once `finishedAt` is set.
- **Source Breakdown Cards**:
  - Side-by-side cards for `Jobstreet` and `Loker.id`.
  - Status indicator, discovered count, new count, duplicates, duration.
- **Search Settings & Intents**:
  - Snapshot of roles, locations, work modes, posted age limit, trigger type.
- **Stage Progress Checklist**:
  - Compact vertical progress tracker.
  - Displays checkmark, spinner, or pending circle.
  - Subtle `✦ AI` badge next to AI-powered stages.
- **Summary Counters**:
  - Discovered, New Jobs, Duplicates, Filtered, Sent to Matching, Recommended.
- **Run Timeline**:
  - Timestamped operational event log (safe, user-friendly messages).
- **Completion Actions**:
  - When `completed` or `partial`:
    - Button: `"View New Jobs"` -> routes to `/jobs`.
    - Button: `"Back to Jobs"`.
  - When `failed`:
    - Button: `"Try Again"` -> triggers fresh run.
    - Button: `"Back to Jobs"`.

### 3.4 Polling & Lifecycle
- Polls `GET /api/search-runs/:id` every 2.5 seconds when `status === 'pending' || status === 'running'`.
- Stops polling once `completed`, `partial`, or `failed` is reached.
- Cleans up timers in `onUnmounted`.
- Survives browser refresh: loads directly via `GET /api/search-runs/:id` and resumes polling if still running.

---

## 4. AI Labeling Rules (Strict Provenance)
- **Label `✦ AI` is applied ONLY to**:
  - `ai_matching` stage.
  - Recommendation explanation.
  - Vector embedding generation.
- **Label `✦ AI` is NEVER applied to**:
  - Scraper data extraction.
  - URL normalization.
  - Duplicate checksums.
  - Date parsing.
  - Freshness filtering.
  - Keyword and role alias expansion.
  - Location normalization.

---

## 5. Testing & Verification

1. **Backend Tests**:
   - `search-execution.repository.test.ts`: test execution creation, stage updates, timeline appends, and completion.
   - `candidate-search.service.test.ts`: test parent execution tracking, multi-source partial failure, and AI error isolation.
   - `search-runs-api.test.ts`: test `GET /api/search-runs/:id` and `GET /api/search-runs` authentication and response structure.
2. **Frontend Tests**:
   - `SearchControlCard.test.ts`: verify redirection to `/search-runs/:id`.
   - `SearchRunDetailView.test.ts`: verify live status rendering, multi-source card display, stage checklist, `✦ AI` badging, elapsed timer calculation, and completion actions.
3. **Workspace Verification**:
   - Run `bun test`, `bun run typecheck`, and `bun run build` across backend and frontend workspaces.
