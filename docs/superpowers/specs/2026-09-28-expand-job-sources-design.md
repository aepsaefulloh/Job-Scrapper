# Technical Design: Expand Job Sources (KitaLulus, Kalibrr, Karir.com, Indeed, LinkedIn)

**Date**: 2026-09-28  
**Author**: Antigravity & Aep Saefulloh  
**Status**: Approved  

---

## 1. Overview & Goals

This milestone expands the JobToolkit scraping ecosystem by adding 5 new job portal scraper providers:
1. **KitaLulus** (`kitalulus`): Leading Indonesian workforce portal
2. **Kalibrr** (`kalibrr`): Prominent Southeast Asian hiring platform
3. **Karir.com** (`karir`): Established Indonesian recruitment portal
4. **Indeed** (`indeed`): Global search engine (Indonesian portal `id.indeed.com`) with defensive anti-bot protection
5. **LinkedIn** (`linkedin`): Global professional network via public guest job search endpoints

### Key Principles & Constraints
- **Zero LLM in Scraping**: Scraping, DOM parsing, date conversion, normalization, freshness filtering, and deduplication remain 100% deterministic code.
- **Candidate-Driven Search**: Search intents are derived from candidate profiles and search preferences (no hardcoded keywords per provider).
- **Graceful Isolation & Partial Failure**: Failure or anti-bot challenge on one provider (e.g. LinkedIn guest wall or Indeed CAPTCHA) never aborts the execution; other successful sources continue and are ingested.
- **Centralized Registry**: Dynamic source registration via `JOB_SOURCE_REGISTRY` so UI components (preferences modal, filters, telemetry) automatically adapt.
- **Phased Rollout**:
  - **Batch 1 (Local Portals)**: KitaLulus, Kalibrr, Karir.com
  - **Batch 2 (Global & Anti-Bot Sensitive Portals)**: Indeed, LinkedIn

---

## 2. Architecture & Data Flow

```text
Candidate Profile + Search Preferences
           ↓
     Search Planner
           ↓
 Selected Sources (Jobstreet, Loker.id, Dealls, Glints, KitaLulus, Kalibrr, Karir, Indeed, LinkedIn)
           ↓
   Scraper Orchestrator (Concurrent / Isolated per Source)
     ├── KitaLulus Scraper  (Camoufox/DOM) → ScrapedJob[]
     ├── Kalibrr Scraper    (Camoufox/DOM) → ScrapedJob[]
     ├── Karir.com Scraper  (Camoufox/DOM) → ScrapedJob[]
     ├── Indeed Scraper     (Defensive Camoufox) → ScrapedJob[]
     └── LinkedIn Scraper   (Defensive Guest API/HTML) → ScrapedJob[]
           ↓
   Deterministic Normalizer (URL canonicalization, checksums, salary, workMode)
           ↓
   Deduplication (via normalized URL checksum)
           ↓
   Freshness Filter (publishedAt <= maxPostingAgeDays, default 7 days)
           ↓
   Ingestion Service (Raw Job Input → Ingested Jobs in Database)
           ↓
   Deterministic Eligibility Filter (Hard filters, role/skill scoring)
           ↓
   LLM Evaluation (SUMOPOD AI, only for top eligible candidate jobs)
```

---

## 3. Component Specifications

### 3.1 Centralized Registry (`backend/src/search/job-source-registry.ts`)
Update `JOB_SOURCE_REGISTRY` to mark all supported adapters as available and specify capabilities:
```typescript
{
  id: 'kitalulus',
  name: 'KitaLulus',
  available: true,
  supportsLocation: true,
  supportsFreshness: true,
  supportsWorkMode: true,
  description: 'Indonesian workforce portal',
},
{
  id: 'kalibrr',
  name: 'Kalibrr',
  available: true,
  supportsLocation: true,
  supportsFreshness: true,
  supportsWorkMode: true,
  description: 'Southeast Asia recruitment platform',
},
{
  id: 'karir',
  name: 'Karir.com',
  available: true,
  supportsLocation: true,
  supportsFreshness: true,
  supportsWorkMode: false,
  description: 'Indonesian job portal',
},
{
  id: 'indeed',
  name: 'Indeed',
  available: true,
  supportsLocation: true,
  supportsFreshness: true,
  supportsWorkMode: true,
  description: 'Global job search engine (ID)',
},
{
  id: 'linkedin',
  name: 'LinkedIn',
  available: true,
  supportsLocation: true,
  supportsFreshness: true,
  supportsWorkMode: true,
  description: 'Professional networking & jobs (Guest)',
}
```

### 3.2 Provider Adapter Modular Design
Each provider follows the isolated provider architecture in `backend/src/scraping/providers/<source>/`:

```text
backend/src/scraping/providers/
├── kitalulus/
│   ├── kitalulus.scraper.ts
│   ├── kitalulus.parser.ts
│   ├── kitalulus.types.ts
│   └── __tests__/kitalulus.parser.test.ts
├── kalibrr/
│   ├── kalibrr.scraper.ts
│   ├── kalibrr.parser.ts
│   ├── kalibrr.types.ts
│   └── __tests__/kalibrr.parser.test.ts
├── karir/
│   ├── karir.scraper.ts
│   ├── karir.parser.ts
│   ├── karir.types.ts
│   └── __tests__/karir.parser.test.ts
├── indeed/
│   ├── indeed.scraper.ts
│   ├── indeed.parser.ts
│   ├── indeed.types.ts
│   └── __tests__/indeed.parser.test.ts
└── linkedin/
    ├── linkedin.scraper.ts
    ├── linkedin.parser.ts
    ├── linkedin.types.ts
    └── __tests__/linkedin.parser.test.ts
```

#### Canonical Mapping (`ScrapedJob` contract):
- `title`: Extracted string, trimmed, collapsed whitespace.
- `company`: Employer / hiring organization.
- `location`: Clean city / region string or `undefined`.
- `workMode`: Inferred deterministically: `'remote' | 'hybrid' | 'onsite' | 'unknown'`.
- `employmentType`: Inferred from tags: `'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance'`.
- `salaryMin`, `salaryMax`, `salaryCurrency`: Parsed numbers and ISO currency code (e.g. `IDR`).
- `description`: Clean text of job overview and responsibilities.
- `requirements`, `skills`: Extracted qualification bullets or tags.
- `publishedAt`: ISO 8601 string parsed deterministically using `parseRelativeDate` (handling Indonesian keywords like "hari yang lalu", "jam yang lalu", "kemarin", and English "days ago", "hours ago").
- `jobUrl`: Complete, canonical, non-redirect URL.
- `externalId`: Source-specific unique identifier.
- `source`: Identifier string matching registry ID.

---

## 4. Defensive Anti-Bot & Isolation Strategy (Indeed & LinkedIn)

1. **Indeed**:
   - Target portal: `https://id.indeed.com/jobs?q={keyword}&l={location}&fromage={days}`.
   - Canonicalizes search URLs from `rc/clk?...` tracking links to `https://id.indeed.com/viewjob?jk={jobKey}`.
   - Detects Cloudflare/CAPTCHA challenge pages via page content signatures. If challenged, returns any extracted jobs without throwing an uncaught exception, logging `scraper.indeed.blocked` with concrete telemetry.

2. **LinkedIn**:
   - Uses public guest endpoints: `https://www.linkedin.com/jobs/search?keywords={keyword}&location={location}&f_TPR=r{seconds}` or guest HTML fragments.
   - Canonicalizes links to `https://www.linkedin.com/jobs/view/{jobId}`.
   - Detects authwall / HTTP 429. If detected, records safe error and gracefully completes with available data.

3. **Multi-Source Partial Status**:
   - When one provider fails or is blocked while others succeed, the orchestrator sets `status = 'partial'`, records the error on that source's `scrape_runs` row, and persists all successfully ingested jobs.

---

## 5. UI Integration & Transparency

- **Search Preferences Modal**: Displays all enabled sources from registry.
- **Search Control Card**: Shows active source badges and allows toggling any source.
- **Search History & Run Details**: Renders individual telemetry breakdown cards for each active source in the run.
- **Jobs Filter**: Supports filtering catalog by any source in the registry.

---

## 6. Testing Strategy

1. **Unit Fixture Tests (100% Offline)**:
   - For every provider, test `parse<Source>SearchPage` and `parse<Source>DetailPage` with saved HTML fixtures.
   - Test cases:
     - Standard job cards extraction
     - Relative date parsing (Indonesian & English)
     - Missing optional fields (salary, workMode, requirements)
     - Pagination link detection
     - Malformed or empty HTML handling
2. **Orchestrator Integration Tests**:
   - Verify all 5 new scrapers are registered and executed correctly.
   - Verify partial failure isolation when one source fails.
3. **Controlled Live Smoke Tests**:
   - Run 1 page (`maxPages: 1`, `detailLimit: 2`) against live endpoints for each source.
4. **Verification Gates**:
   - Backend `bun test` passes.
   - Frontend `bun run test` passes.
   - Strict TypeScript `bun run typecheck` passes (0 errors).
   - Production build passes.
