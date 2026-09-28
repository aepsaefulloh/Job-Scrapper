# Expand Job Sources (KitaLulus, Kalibrr, Karir.com, Indeed, LinkedIn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 new job portal scraper adapters (KitaLulus, Kalibrr, Karir.com, Indeed, LinkedIn) following the existing modular architecture with 0 LLM in scraping and defensive anti-bot isolation.

**Architecture:** Each provider is implemented in its own modular folder under `backend/src/scraping/providers/<source>/` with pure deterministic parsers (`<source>.parser.ts`), typed interfaces (`<source>.types.ts`), and Camoufox/HTTP scraper implementations (`<source>.scraper.ts`). Sources are registered in `JOB_SOURCE_REGISTRY` and executed through `ScraperOrchestrator` with partial failure resilience.

**Tech Stack:** Node.js, TypeScript strict mode, Cheerio, Camoufox/Playwright BrowserService, Bun Test, Vitest.

## Global Constraints

- **Zero LLM in Scraping**: Scraping, DOM extraction, relative date conversion, and normalization must not call any LLM.
- **Canonical Mapping**: All jobs map strictly to `ScrapedJob` without invented fields.
- **Candidate-Driven**: Search queries must come from `CandidateSearchProfile` + `JobSearchPreferences`.
- **Anti-Bot Defensive Isolation**: Indeed and LinkedIn must catch challenge pages or authwalls gracefully and never crash other providers.
- **Partial Failure Support**: When some providers fail and others succeed, the overall run is marked `partial` and successful jobs are preserved.

---

### Task 1: Centralized Job Source Registry Update

**Files:**
- Modify: `backend/src/search/job-source-registry.ts`
- Test: `backend/tests/unit/search/job-source-registry.test.ts`

**Interfaces:**
- Produces: `JOB_SOURCE_REGISTRY` containing all 5 sources with `available: true` and appropriate capability flags (`supportsLocation`, `supportsFreshness`, `supportsWorkMode`).

- [ ] **Step 1: Write the failing test**
  Add tests in `backend/tests/unit/search/job-source-registry.test.ts` expecting `kitalulus`, `kalibrr`, `karir`, `indeed`, and `linkedin` to be available.

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/search/job-source-registry.test.ts`.

- [ ] **Step 3: Update `JOB_SOURCE_REGISTRY`**
  Update the definitions in `backend/src/search/job-source-registry.ts` to set `available: true` and their capabilities.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/search/job-source-registry.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(search): enable kitalulus, kalibrr, karir, indeed, and linkedin in source registry"`

---

### Task 2: KitaLulus Provider Adapter (Batch 1)

**Files:**
- Create: `backend/src/scraping/providers/kitalulus/kitalulus.types.ts`
- Create: `backend/src/scraping/providers/kitalulus/kitalulus.parser.ts`
- Create: `backend/src/scraping/providers/kitalulus/kitalulus.scraper.ts`
- Test: `backend/tests/unit/scraping/providers/kitalulus.parser.test.ts`

**Interfaces:**
- Produces: `KitaLulusScraper implements JobScraper`, `parseKitaLulusSearchPage`, `parseKitaLulusDetailPage`.

- [ ] **Step 1: Write the failing parser tests**
  Create `backend/tests/unit/scraping/providers/kitalulus.parser.test.ts` with HTML fixture testing:
  - Search page listing extraction (title, company, location, salary, publishedAt relative date, URL)
  - Detail page description and requirements extraction
  - Missing optional fields handling
  - Pagination token/page link detection

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/providers/kitalulus.parser.test.ts`.

- [ ] **Step 3: Implement `kitalulus.types.ts`, `kitalulus.parser.ts`, and `kitalulus.scraper.ts`**
  - Implement deterministic HTML parsing with Cheerio.
  - Implement `KitaLulusScraper` handling `JobSearchQuery`, navigating via `BrowserService`, retry, and detail page fetching bounded by `detailLimit`.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/providers/kitalulus.parser.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(scraper): implement kitalulus provider adapter and parser tests"`

---

### Task 3: Kalibrr Provider Adapter (Batch 1)

**Files:**
- Create: `backend/src/scraping/providers/kalibrr/kalibrr.types.ts`
- Create: `backend/src/scraping/providers/kalibrr/kalibrr.parser.ts`
- Create: `backend/src/scraping/providers/kalibrr/kalibrr.scraper.ts`
- Test: `backend/tests/unit/scraping/providers/kalibrr.parser.test.ts`

**Interfaces:**
- Produces: `KalibrrScraper implements JobScraper`, `parseKalibrrSearchPage`, `parseKalibrrDetailPage`.

- [ ] **Step 1: Write the failing parser tests**
  Create `backend/tests/unit/scraping/providers/kalibrr.parser.test.ts` with HTML fixture testing:
  - Job card parsing (title, company, workMode, location, published date, canonical job URL)
  - Detail page responsibilities & qualifications extraction
  - Missing field resilience and relative date parsing

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/providers/kalibrr.parser.test.ts`.

- [ ] **Step 3: Implement `kalibrr.types.ts`, `kalibrr.parser.ts`, and `kalibrr.scraper.ts`**
  - Implement parsing logic for Kalibrr job board HTML.
  - Implement `KalibrrScraper` with `JobScraper` interface and bounded pagination.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/providers/kalibrr.parser.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(scraper): implement kalibrr provider adapter and parser tests"`

---

### Task 4: Karir.com Provider Adapter (Batch 1)

**Files:**
- Create: `backend/src/scraping/providers/karir/karir.types.ts`
- Create: `backend/src/scraping/providers/karir/karir.parser.ts`
- Create: `backend/src/scraping/providers/karir/karir.scraper.ts`
- Test: `backend/tests/unit/scraping/providers/karir.parser.test.ts`

**Interfaces:**
- Produces: `KarirScraper implements JobScraper`, `parseKarirSearchPage`, `parseKarirDetailPage`.

- [ ] **Step 1: Write the failing parser tests**
  Create `backend/tests/unit/scraping/providers/karir.parser.test.ts` with HTML fixture testing:
  - Search listing extraction (title, company, location, salary, posted date, canonical URL)
  - Detail page description extraction
  - Indonesian relative date strings ("1 hari yang lalu", "3 hari yang lalu", "kemarin")

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/providers/karir.parser.test.ts`.

- [ ] **Step 3: Implement `karir.types.ts`, `karir.parser.ts`, and `karir.scraper.ts`**
  - Implement Karir.com semantic HTML parser.
  - Implement `KarirScraper` with session handling and retry.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/providers/karir.parser.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(scraper): implement karir.com provider adapter and parser tests"`

---

### Task 5: Indeed Provider Adapter (Batch 2 - Defensive & Anti-Bot)

**Files:**
- Create: `backend/src/scraping/providers/indeed/indeed.types.ts`
- Create: `backend/src/scraping/providers/indeed/indeed.parser.ts`
- Create: `backend/src/scraping/providers/indeed/indeed.scraper.ts`
- Test: `backend/tests/unit/scraping/providers/indeed.parser.test.ts`

**Interfaces:**
- Produces: `IndeedScraper implements JobScraper`, `parseIndeedSearchPage`, `parseIndeedDetailPage`, `detectIndeedChallenge`.

- [ ] **Step 1: Write the failing parser tests**
  Create `backend/tests/unit/scraping/providers/indeed.parser.test.ts` with HTML fixture testing:
  - Extraction of job cards (`jk` attribute, title, company, location, snippet, relative date)
  - Canonical URL conversion (`https://id.indeed.com/viewjob?jk={jobKey}`)
  - Cloudflare/CAPTCHA challenge page detection (`detectIndeedChallenge`) returning true on challenge HTML
  - Empty or obfuscated markup resilience

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/providers/indeed.parser.test.ts`.

- [ ] **Step 3: Implement `indeed.types.ts`, `indeed.parser.ts`, and `indeed.scraper.ts`**
  - Implement deterministic parser and challenge detector.
  - In `IndeedScraper`, navigate using `fromage` native freshness parameter, detect challenges gracefully, catch detail navigation errors, and log telemetry.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/providers/indeed.parser.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(scraper): implement defensive indeed provider adapter and parser tests"`

---

### Task 6: LinkedIn Provider Adapter (Batch 2 - Defensive Guest API/HTML)

**Files:**
- Create: `backend/src/scraping/providers/linkedin/linkedin.types.ts`
- Create: `backend/src/scraping/providers/linkedin/linkedin.parser.ts`
- Create: `backend/src/scraping/providers/linkedin/linkedin.scraper.ts`
- Test: `backend/tests/unit/scraping/providers/linkedin.parser.test.ts`

**Interfaces:**
- Produces: `LinkedInScraper implements JobScraper`, `parseLinkedInSearchPage`, `parseLinkedInDetailPage`, `detectLinkedInAuthWall`.

- [ ] **Step 1: Write the failing parser tests**
  Create `backend/tests/unit/scraping/providers/linkedin.parser.test.ts` with HTML fixture testing:
  - Guest job card parsing (`base-card`, job title, company name, location, published date, canonical URL `jobs/view/{id}`)
  - Authwall / sign-in prompt detection (`detectLinkedInAuthWall`)
  - Missing field resilience

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/providers/linkedin.parser.test.ts`.

- [ ] **Step 3: Implement `linkedin.types.ts`, `linkedin.parser.ts`, and `linkedin.scraper.ts`**
  - Implement public guest search scraper using `f_TPR=r{seconds}` native freshness filter.
  - Implement defensive handling: if authwall or rate limit appears, log telemetry and return collected jobs without crashing.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/providers/linkedin.parser.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(scraper): implement defensive linkedin guest provider adapter and parser tests"`

---

### Task 7: Scraper Orchestrator Registration & Orchestration Tests

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/unit/scraping/scraper-orchestrator.test.ts`

**Interfaces:**
- Consumes: All 5 new scraper instances.
- Produces: `ScraperOrchestrator` loaded with all registered scrapers, supporting partial failures.

- [ ] **Step 1: Write the failing orchestrator integration tests**
  Add tests in `backend/tests/unit/scraping/scraper-orchestrator.test.ts` verifying:
  - Execution across all registered scrapers
  - Partial failure when one provider throws or is blocked, verifying other sources are ingested successfully

- [ ] **Step 2: Run test to confirm failure**
  Run `bun test backend/tests/unit/scraping/scraper-orchestrator.test.ts`.

- [ ] **Step 3: Wire new scrapers into `app.ts`**
  Register `KitaLulusScraper`, `KalibrrScraper`, `KarirScraper`, `IndeedScraper`, and `LinkedInScraper` in `backend/src/app.ts`.

- [ ] **Step 4: Run test to confirm pass**
  Run `bun test backend/tests/unit/scraping/scraper-orchestrator.test.ts`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(orchestrator): wire all 5 new scrapers with partial failure isolation"`

---

### Task 8: Full Verification & Controlled Smoke Test

**Files:**
- Test: Full backend & frontend test suites

- [ ] **Step 1: Run complete backend test suite**
  Run `bun test` in `backend`. Confirm all unit and integration tests pass.

- [ ] **Step 2: Run complete frontend test suite**
  Run `bun run test` in `frontend`. Confirm all vitest tests pass.

- [ ] **Step 3: Run TypeScript checks**
  Run `bun run typecheck` in both `backend` and `frontend`. Confirm 0 errors.

- [ ] **Step 4: Run production build**
  Run `bun run build` in both `backend` and `frontend`. Confirm clean builds.

- [ ] **Step 5: Commit and summary**
  `git commit -m "feat(scraping): complete expand job sources milestone with full verification"`
