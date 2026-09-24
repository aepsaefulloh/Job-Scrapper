# Complete Multi-Source Job Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Dealls and Glints as mature, candidate-driven discovery sources alongside Jobstreet and Loker.id, with centralized source registry capabilities, 7-day freshness enforcement, multi-source partial failure resilience, and dynamic frontend controls.

**Architecture:**
- Extends the existing `JobScraper` contract with `DeallsScraper` (`scraping/providers/dealls/`) and activates `GlintsScraper` (`scraping/providers/glints/`).
- Centralizes source definitions in `job-source-registry.ts` with explicit booleans (`supportsLocation`, `supportsFreshness`, `supportsWorkMode`).
- `CandidateSearchService` dynamically discovers available sources from the registry, executes multi-source searches in parallel child scrape runs, and resolves overall status to `partial` if any source fails while others succeed.
- Frontend selects and filters sources dynamically via `useJobSources()` from `GET /api/job-sources`.

**Tech Stack:** Node.js, TypeScript strict mode, Express, Supabase (PostgreSQL), Camoufox (Playwright/Firefox), Vue 3, Vite, Vitest.

## Global Constraints

- No scrapers for LinkedIn or Indeed in this milestone.
- Standard unit/integration tests MUST NOT require internet connectivity (use offline HTML fixtures).
- Enforce `maxPostingAgeDays = 7` by default.
- Scraped jobs must map to the canonical job schema without inventing unsupported fields.
- Preserves raw source payloads for audit and reprocessing.
- Do NOT push or create a pull request without explicit user approval.

---

### Task 1: Dealls Offline Fixtures and Type Definitions

**Files:**
- Create: `backend/tests/fixtures/scrapers/dealls/search-page.html`
- Create: `backend/tests/fixtures/scrapers/dealls/job-detail.html`
- Create: `backend/src/scraping/providers/dealls/dealls.types.ts`

**Interfaces:**
- Produces: `DeallsJobDoc`, `DeallsSearchQueryState`, `DeallsDetailPageState` TypeScript types in `dealls.types.ts`.

- [ ] **Step 1: Create Dealls offline HTML fixtures**
Save valid offline HTML fixtures containing Next.js `__NEXT_DATA__` scripts for both search and detail pages.

- [ ] **Step 2: Create `dealls.types.ts`**
Define interfaces for the Next.js hydration payload:
```typescript
export interface DeallsJobDoc {
  id: string;
  slug: string;
  role: string;
  employmentTypes?: string[];
  workplaceType?: string;
  publishedAt?: string;
  status?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    display?: string;
  } | null;
  company?: {
    name?: string;
    slug?: string;
  };
  city?: {
    name?: string;
  };
  country?: {
    name?: string;
  };
  skills?: Array<{
    id: string;
    name: string;
  }>;
}

export interface DeallsDetailJobData {
  id: string;
  slug: string;
  role: string;
  description?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  perks?: string[] | null;
}
```

- [ ] **Step 3: Commit Task 1**
```bash
git add backend/tests/fixtures/scrapers/dealls/ backend/src/scraping/providers/dealls/dealls.types.ts
git commit -m "feat(scraping): add dealls offline fixtures and type definitions"
```

---

### Task 2: Dealls Parser Implementation & Unit Tests

**Files:**
- Create: `backend/src/scraping/providers/dealls/dealls.parser.ts`
- Create: `backend/tests/unit/scraping/dealls-parser.test.ts`

**Interfaces:**
- Produces: `parseDeallsSearchPage(html: string, baseUrl?: string, scrapedAt?: string): ScrapedJob[]`
- Produces: `parseDeallsDetailPage(html: string): string | undefined`

- [ ] **Step 1: Write failing unit test in `dealls-parser.test.ts`**
Test parsing search page fixture (extracting externalId, title, company, location, workMode, employmentType, salary, skills, ISO publishedAt, canonical jobUrl).
Test DOM fallback when `__NEXT_DATA__` is absent.
Test detail page parser combining responsibilities and requirements.
Test malformed JSON handling.

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test tests/unit/scraping/dealls-parser.test.ts`
Expected: FAIL (Cannot find module `dealls.parser.js`)

- [ ] **Step 3: Implement `dealls.parser.ts`**
Extract `__NEXT_DATA__`, parse `docs`, map canonical fields, extract detail responsibilities/requirements, and provide DOM fallback.

- [ ] **Step 4: Run test to verify it passes**
Run: `bun test tests/unit/scraping/dealls-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```bash
git add backend/src/scraping/providers/dealls/dealls.parser.ts backend/tests/unit/scraping/dealls-parser.test.ts
git commit -m "feat(scraping): implement dealls parser with tests"
```

---

### Task 3: Dealls Scraper Implementation & Unit Tests

**Files:**
- Create: `backend/src/scraping/providers/dealls/dealls.scraper.ts`
- Create: `backend/tests/unit/scraping/dealls-scraper.test.ts`

**Interfaces:**
- Produces: `DeallsScraper implements JobScraper` (`source: 'dealls'`, `search(query: JobSearchQuery): Promise<ScrapedJob[]>`)

- [ ] **Step 1: Write failing unit test in `dealls-scraper.test.ts`**
Mock `BrowserService`.
Verify `maxPages` limits navigation.
Verify retry on transient failures.
Verify detail failure resilience (preserves summary job if detail fetch throws).

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test tests/unit/scraping/dealls-scraper.test.ts`
Expected: FAIL (Cannot find module `dealls.scraper.js`)

- [ ] **Step 3: Implement `dealls.scraper.ts`**
Use `this.browser.createSession()`, loop pages up to `maxPages`, navigate to detail pages with try/catch fallback, return scraped jobs.

- [ ] **Step 4: Run test to verify it passes**
Run: `bun test tests/unit/scraping/dealls-scraper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 3**
```bash
git add backend/src/scraping/providers/dealls/dealls.scraper.ts backend/tests/unit/scraping/dealls-scraper.test.ts
git commit -m "feat(scraping): implement dealls scraper with tests"
```

---

### Task 4: Glints Scraper Verification and Canonical Mapping Check

**Files:**
- Modify: `backend/src/scraping/providers/glints/glints.scraper.ts`
- Modify: `backend/src/scraping/providers/glints/glints.parser.ts`
- Test: `backend/tests/unit/scraping/glints-parser.test.ts`
- Test: `backend/tests/unit/scraping/glints-scraper.test.ts`

- [ ] **Step 1: Add logger support and detail error isolation to `glints.scraper.ts`**
Ensure `GlintsScraper` accepts optional `logger?: Logger` and logs detail failures without aborting the run.

- [ ] **Step 2: Run existing Glints unit tests**
Run: `bun test tests/unit/scraping/glints-*.test.ts`
Expected: PASS

- [ ] **Step 3: Commit Task 4**
```bash
git add backend/src/scraping/providers/glints/
git commit -m "feat(scraping): refine glints scraper resilience and logging"
```

---

### Task 5: Central Job Source Registry Update

**Files:**
- Modify: `backend/src/search/job-source-registry.ts`
- Modify: `backend/src/search/preferences-types.ts`
- Modify: `backend/tests/unit/search/job-source-registry.test.ts`
- Modify: `backend/tests/integration/api/job-sources-api.test.ts`
- Modify: `frontend/src/types/job-source.ts`
- Modify: `frontend/src/composables/useJobSources.ts`

- [ ] **Step 1: Update test expectations in `job-source-registry.test.ts` and `job-sources-api.test.ts`**
Expect `dealls` and `glints` to have `available: true`, `supportsLocation: true`, `supportsFreshness: true`, `supportsWorkMode: true`.
Expect `JobSourceDefinition` fields (`supportsLocation`, `supportsFreshness`, `supportsWorkMode`) to be non-optional booleans.

- [ ] **Step 2: Run tests to verify failures**
Run: `bun test tests/unit/search/job-source-registry.test.ts tests/integration/api/job-sources-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `job-source-registry.ts` and `preferences-types.ts`**
Set `available: true` and explicit booleans for `dealls` and `glints`.
Update `SUPPORTED_JOB_SOURCES = ['jobstreet', 'loker-id', 'dealls', 'glints'] as const`.
Keep `DEFAULT_SEARCH_PREFERENCES.sources = ['jobstreet', 'loker-id']` (new sources not auto-enabled).
Update frontend types in `frontend/src/types/job-source.ts` and `useJobSources.ts`.

- [ ] **Step 4: Run tests to verify they pass**
Run: `bun test tests/unit/search/job-source-registry.test.ts tests/integration/api/job-sources-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 5**
```bash
git add backend/src/search/job-source-registry.ts backend/src/search/preferences-types.ts backend/tests/ frontend/src/types/job-source.ts frontend/src/composables/useJobSources.ts
git commit -m "feat(search): activate dealls and glints in job source registry"
```

---

### Task 6: Candidate Search Service & Multi-Source Partial Failure Handling

**Files:**
- Modify: `backend/src/search/candidate-search.service.ts`
- Modify: `backend/tests/unit/search/candidate-search-service.test.ts` (or create if needed)
- Modify: `backend/tests/unit/search/search-planner.test.ts`

- [ ] **Step 1: Write unit test verifying candidate search with all 4 sources and partial failure**
Test that `supportedSources` allows `dealls` and `glints`.
Test that when one source fails (e.g. `dealls` throws error) while another succeeds (e.g. `jobstreet` returns jobs), the parent execution status is set to `'partial'` and successful jobs are preserved.

- [ ] **Step 2: Run test to verify it fails if not implemented**

- [ ] **Step 3: Update `candidate-search.service.ts`**
Replace hardcoded `new Set(['jobstreet', 'loker-id'])` with dynamic `new Set(getAvailableJobSourceIds())`.
Format source names cleanly using registry names.
Verify partial failure status resolution logic.

- [ ] **Step 4: Run test to verify it passes**
Run: `bun test tests/unit/search/`
Expected: PASS

- [ ] **Step 5: Commit Task 6**
```bash
git add backend/src/search/candidate-search.service.ts backend/tests/
git commit -m "feat(search): enable dynamic multi-source candidate search and partial failure handling"
```

---

### Task 7: Scraper Orchestrator & Server Wiring

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Wire `DeallsScraper` and `GlintsScraper` into `ScraperOrchestrator` in `server.ts`**
Import `DeallsScraper` and `GlintsScraper`.
Instantiate both in `createCandidateSearchService` and `executeScrape`:
```typescript
new ScraperOrchestrator(
  [
    new JobstreetScraper(new CamoufoxBrowserService(env.camoufoxExecutablePath)),
    new LokerIdScraper(new CamoufoxBrowserService(env.camoufoxExecutablePath)),
    new DeallsScraper(new CamoufoxBrowserService(env.camoufoxExecutablePath)),
    new GlintsScraper(new CamoufoxBrowserService(env.camoufoxExecutablePath)),
  ],
  ...
)
```

- [ ] **Step 2: Typecheck backend**
Run: `bun run typecheck` in `backend`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit Task 7**
```bash
git add backend/src/server.ts
git commit -m "feat(server): wire dealls and glints scrapers into orchestrator"
```

---

### Task 8: Dynamic Frontend Source Filtering

**Files:**
- Modify: `frontend/src/components/jobs/JobFilterBar.vue`
- Modify: `frontend/src/views/SearchHistoryView.vue`
- Test: `frontend/src/views/__tests__/SearchHistoryView.test.ts`

- [ ] **Step 1: Update `JobFilterBar.vue` to use dynamic sources**
Use `useJobSources()` -> `availableSources` to render `<option>` tags dynamically instead of hardcoded Jobstreet / Loker.id.

- [ ] **Step 2: Update `SearchHistoryView.vue` to use dynamic sources**
Use `useJobSources()` -> `availableSources` to render source filter options dynamically.

- [ ] **Step 3: Run frontend vitest suite**
Run: `bun run test` in `frontend`
Expected: All tests PASS.

- [ ] **Step 4: Commit Task 8**
```bash
git add frontend/src/components/jobs/JobFilterBar.vue frontend/src/views/SearchHistoryView.vue
git commit -m "feat(frontend): use dynamic sources for job filter and history view"
```

---

### Task 9: Controlled Live Smoke Test Script

**Files:**
- Create: `backend/tests/manual/smoke-dealls-glints.ts`

- [ ] **Step 1: Write smoke script**
Create script running `DeallsScraper` and `GlintsScraper` with candidate-generated keyword (e.g. "Software Engineer" / "Accountant") with `maxPages: 1` using real `CamoufoxBrowserService`.
Verifies:
- Scraper session starts and retrieves search page.
- At least 1 job is discovered and mapped to canonical fields.
- Detail page parsed or fallback description present.
- Freshness filter verifies posting date.

- [ ] **Step 2: Execute smoke script**
Run: `bun run tests/manual/smoke-dealls-glints.ts`
Verify successful discovery on both sources.

- [ ] **Step 3: Commit Task 9**
```bash
git add backend/tests/manual/smoke-dealls-glints.ts
git commit -m "test(manual): add live smoke test script for dealls and glints"
```

---

### Task 10: Complete Verification Suite

**Files:**
- Verify: All tests across backend and frontend
- Verify: TypeScript strict typecheck across backend and frontend
- Verify: Production build across backend and frontend

- [ ] **Step 1: Run all backend tests**
Run: `bun test` in `backend`
Expected: All tests PASS.

- [ ] **Step 2: Run all frontend tests**
Run: `bun run test` in `frontend`
Expected: All tests PASS.

- [ ] **Step 3: Typecheck both workspaces**
Run: `bun run typecheck` in `backend` and `frontend`
Expected: 0 errors.

- [ ] **Step 4: Build production bundle**
Run: `bun run build` in `frontend` and `backend`
Expected: Build succeeds cleanly.
