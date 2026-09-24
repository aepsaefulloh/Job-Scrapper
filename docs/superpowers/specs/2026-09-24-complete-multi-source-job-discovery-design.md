# Complete Multi-Source Job Discovery Design Specification

## Overview

This specification details the expansion of the Personal Job Agent to support four active Indonesian and Southeast Asian job discovery sources:
1. **Jobstreet** (`jobstreet`) - Existing active
2. **Loker.id** (`loker-id`) - Existing active
3. **Dealls** (`dealls`) - New active
4. **Glints** (`glints`) - New active

Sources such as LinkedIn, Indeed, KitaLulus, Kalibrr, and Karir.com remain registered as unavailable (`available: false`, "Coming soon") and are explicitly excluded from scraping execution in this milestone.

## 1. Central Job Source Registry

### Schema and Source of Truth
The backend registry in `src/search/job-source-registry.ts` is the single source of truth for all job sources and capabilities.

```typescript
export interface JobSourceDefinition {
  id: string;
  name: string;
  available: boolean;
  supportsLocation: boolean;
  supportsFreshness: boolean;
  supportsWorkMode: boolean;
  description?: string;
}
```

Registered sources and capabilities:
- `jobstreet`: `available: true`, `supportsLocation: true`, `supportsFreshness: true`, `supportsWorkMode: true`
- `loker-id`: `available: true`, `supportsLocation: true`, `supportsFreshness: true`, `supportsWorkMode: false`
- `dealls`: `available: true`, `supportsLocation: true`, `supportsFreshness: true`, `supportsWorkMode: true`
- `glints`: `available: true`, `supportsLocation: true`, `supportsFreshness: true`, `supportsWorkMode: true`
- `indeed`, `linkedin`, `kitalulus`, `kalibrr`, `karir-com`: `available: false`, all feature flags `false`.

### API Endpoint
- Route: `GET /api/job-sources` (or `/job-sources` via Express router mounted under `/api` in production)
- Response: `JobSourceDefinition[]`
- Unauthenticated / public: Safe metadata list, no secrets.

### Preferences Default Policy
- Default candidate sources in `DEFAULT_SEARCH_PREFERENCES`: `['jobstreet', 'loker-id']`.
- New sources (`dealls`, `glints`) are **not** auto-enabled for existing candidates. Candidates can freely toggle any available source in `SourceMultiSelect.vue` inside `SearchPreferencesModal.vue`.

## 2. Provider Implementations

Both providers conform strictly to the existing `JobScraper` interface:
```typescript
export interface JobScraper {
  readonly source: string;
  search(query: JobSearchQuery): Promise<ScrapedJob[]>;
}
```

### Dealls Provider (`src/scraping/providers/dealls/`)

#### Source Architecture
- Base URL: `https://dealls.com`
- Search Path: `/loker?q={keyword}&location={location}`
- Detail Path: `/loker/{slug}~{companySlug}`

#### Search Page Parsing (`dealls.parser.ts`)
1. **Primary Extraction (`__NEXT_DATA__`)**:
   Dealls is a Next.js application storing server-rendered search queries in React Query dehydration format:
   `props.pageProps.dehydratedState.queries` -> query matching `/v1/explore-job/job` -> `state.data.pages[0].docs`.
   Each doc contains:
   - `id`: string external ID (e.g. `6ab4c5a103617b0012e6b3a6`)
   - `role`: job title
   - `company.name`: company name
   - `city.name`, `country.name`: location string formatted as `${city.name}, ${country.name}` (or city only if country omitted)
   - `workplaceType`: `'onSite' -> 'onsite'`, `'remote' -> 'remote'`, `'hybrid' -> 'hybrid'`
   - `employmentTypes`: string array, first element mapped to canonical `'full-time' | 'contract' | 'internship' | 'part-time' | 'freelance'`
   - `salaryRange`: object `{ min?: number, max?: number, currency?: string }` or null
   - `skills`: array of `{ name: string, id: string }` mapped to `string[]`
   - `publishedAt`: ISO 8601 string (e.g. `2026-09-24T06:39:29.609Z`)
   - `slug`: job slug (e.g. `live-streaming-coordinator-emtek-commerce`)
   - `company.slug`: company slug (e.g. `vidiodotcom`)
   - Canonical `jobUrl`: `https://dealls.com/loker/${doc.slug}~${doc.company?.slug || ''}`
2. **Fallback Regex Parsing**:
   If `__NEXT_DATA__` is absent, matches link tags `/loker/{slug}~{companySlug}` and extracts title and company from DOM text.

#### Detail Page Parsing (`dealls.parser.ts`)
1. **Primary Extraction (`__NEXT_DATA__`)**:
   Detail page query in `dehydratedState.queries` with key `/v1/job-portal/job/slug` containing:
   - `responsibilities`: HTML string with `<ul><li>...`
   - `requirements`: HTML string with `<ul><li>...`
   - `description`: HTML or text string if present
   - `perks`: array or HTML string
   Plaintext conversion strips HTML tags and joins sections:
   `"Responsibilities:\n" + clean(responsibilities) + "\n\nRequirements:\n" + clean(requirements)`
2. **Fallback DOM Parsing**:
   Matches container elements with classes containing `description`, `responsibilities`, or `requirements`.

#### Dealls Scraper Execution (`dealls.scraper.ts`)
- Uses `BrowserService` (Camoufox session) to handle browser navigation.
- Runs with `retryTransient({ maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 1000 })`.
- Per-detail page navigation wrapped in a try/catch: if a detail page navigation fails or returns 404, the scraper logs a warning and preserves the search summary card rather than failing the entire run.

### Glints Provider (`src/scraping/providers/glints/`)

#### Source Architecture
- Base URL: `https://glints.com`
- Search Path: `/id/opportunities/jobs/explore?keyword={keyword}&location={location}&page={page}`
- Detail Path: `/id/opportunities/jobs/{externalId}`

#### Parser & Scraper Verification (`glints.parser.ts`, `glints.scraper.ts`)
- Glints parser extracts `__NEXT_DATA__` (`initialJobs.jobsInPage`), mapping Draft.js description blocks from detail page.
- Canonical mapping converts work arrangements (`REMOTE` -> `remote`, `HYBRID` -> `hybrid`, `ONSITE` -> `onsite`), salaries (`minAmount`, `maxAmount`, `CurrencyCode`), and skills.
- Scraper wired directly into `ScraperOrchestrator` alongside Dealls, Jobstreet, and Loker.id.

## 3. Candidate-Driven Search Pipeline & Concurrency

### Search Flow
```text
Candidate Profile + Search Preferences
                 ↓
           Search Planner
                 ↓
    [Jobstreet, Loker.id, Dealls, Glints]
                 ↓
       CandidateSearchService
                 ↓
        ScraperOrchestrator
                 ↓
     Ingestion & Deduplication
                 ↓
         Freshness Filter (<= 7d)
                 ↓
        Vector Embedding & Matching
```

1. **Source Independence**:
   Sources only define *where* to search. Target roles and keywords are derived from the candidate's active profile and query expander.
2. **Concurrency Identity Guard**:
   Each search is identified by `normalizedSource:normalizedKeyword:normalizedLocation`. Active runs for the same candidate and identity block duplicate runs while allowing distinct sources or keywords to execute simultaneously.
3. **Dynamic Source Support**:
   `CandidateSearchService.supportedSources` derives dynamically from `JOB_SOURCE_REGISTRY` (`available: true`), removing hardcoded sets.

## 4. Freshness & Canonical Model Mapping

### Canonical Model
All raw scraped jobs are converted to `RawJobInput` before persistence:
- `title`: Job title string
- `company`: Company name (or `'Unknown'`)
- `location`: Standardized location string
- `workMode`: `'remote' | 'hybrid' | 'onsite' | undefined`
- `employmentType`: `'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance' | undefined`
- `salaryMin` / `salaryMax` / `salaryCurrency`: Normalized numbers and currency code
- `description`: Plaintext description
- `skills`: Array of string skill names
- `publishedAt`: ISO 8601 string or parsed relative date string
- `jobUrl`: Canonical canonicalized URL
- `source`: `'jobstreet' | 'loker-id' | 'dealls' | 'glints'`

### Freshness Enforcement
- `maxPostingAgeDays`: Enforced to 7 days by default.
- Backend freshness filter (`evaluateFreshness`) runs immediately post-ingestion.
- Unknown posting dates follow candidate preference policy (`'exclude'` by default, `'allow'` if configured).

## 5. Multi-Source Search Execution & Partial Failure Semantics

When `Search Jobs Now` is triggered:
1. `SearchExecutionRecord` is initialized with child stages for each selected source (`stage:scrape:jobstreet`, `stage:scrape:loker-id`, `stage:scrape:dealls`, `stage:scrape:glints`).
2. Child `scrape_runs` are created with metadata linking to `search_execution_id`.
3. Sources are executed. If one source throws an error:
   - The failed source's child run is marked `failed` with error message.
   - The corresponding stage is marked `failed`.
   - Other sources proceed uninterrupted.
4. Final status computation:
   - If all sources fail: `SearchExecution.status = 'failed'`
   - If some sources fail and some succeed: `SearchExecution.status = 'partial'`
   - If all sources succeed: `SearchExecution.status = 'completed'`
   Jobs ingested from successful sources remain fully visible, matched, and actionable.

## 6. Frontend Integration

1. **`SearchPreferencesModal.vue` / `SourceMultiSelect.vue`**:
   - Queries `GET /api/job-sources` via `useJobSources()`.
   - Displays Jobstreet, Loker.id, Dealls, and Glints as selectable available options.
   - Shows other sources as disabled "Coming soon".
2. **`JobFilterBar.vue`**:
   - Dynamically populates the source dropdown from `useJobSources()` (`availableSources`).
3. **`SearchHistoryView.vue`**:
   - Dynamically populates the source filter from `useJobSources()`.
4. **`SearchRunDetailView.vue`**:
   - Renders multi-source breakdown for all active sources with per-source counts (discovered, inserted, duplicates, duration, status badge).

## 7. Fixtures & Testing Matrix

### Offline Fixtures
- `backend/tests/fixtures/scrapers/dealls/search-page.html`: Real static HTML payload containing Next.js `__NEXT_DATA__` with job items.
- `backend/tests/fixtures/scrapers/dealls/job-detail.html`: Real static HTML payload containing Next.js `__NEXT_DATA__` with responsibilities and requirements.
- Existing `backend/tests/fixtures/scrapers/glints/` search & detail fixtures.

### Test Suites
1. **Dealls Parser Unit Tests (`dealls-parser.test.ts`)**:
   - Extract all jobs from `search-page.html`.
   - Verify canonical mapping (title, company, location, workMode, employmentType, salary, skills, ISO publishedAt).
   - Test DOM fallback when `__NEXT_DATA__` is absent.
   - Test detail parser extraction of responsibilities + requirements into plaintext.
   - Test malformed JSON resilience.
2. **Dealls Scraper Unit Tests (`dealls-scraper.test.ts`)**:
   - Mock `BrowserService`.
   - Verify pagination bounds (`maxPages`).
   - Verify transient retry logic.
   - Verify individual detail failure resilience.
3. **Multi-Source Execution & Partial Failure Unit Tests (`candidate-search.service.test.ts`)**:
   - Multi-source execution with all 4 sources.
   - Verify partial failure status when 1 source throws.
4. **Job Source Registry Tests (`job-source-registry.test.ts`)**:
   - Verify all 4 sources return `available: true` with required capability boolean fields.
5. **Live Smoke Test Script (`tests/manual/smoke-dealls-glints.ts`)**:
   - Runs a 1-page query for candidate-generated intent on Dealls and Glints using real Camoufox browser session.
