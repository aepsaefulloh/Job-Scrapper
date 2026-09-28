# Design Spec: Separate Scraping from AI Recommendation

**Date:** 2026-09-28  
**Status:** Approved  
**Author:** Pair Programming Agent & User  

---

## 1. Goal and Objectives

Refactor the job discovery and recommendation pipeline so that **scraping never uses an LLM** and all preliminary filtering is purely deterministic. The LLM is invoked solely to evaluate and produce structured recommendations for jobs that have already passed deterministic pre-filtering, bounded by configurable thresholds and backed by an exact-match AI evaluation cache.

---

## 2. End-to-End Pipeline Architecture

```text
Job Sources (Jobstreet, etc.)
  │
  ▼ [100% Deterministic — 0 LLM]
Scraper & DOM Extraction (Camoufox / Cheerio)
  │
  ▼ [100% Deterministic — 0 LLM]
Normalization & Checksumming (RawJobInput -> NormalizedJob)
  │
  ▼ [100% Deterministic — 0 LLM]
Deduplication & Database Upsert (jobs_raw, jobs, job_skills)
  │
  ▼ [100% Deterministic — 0 LLM]
Pre-LLM Deterministic Filtering (Status, Age, Excluded Roles, Location, Employment Type)
  │
  ▼ [Deterministic & Vector Scoring — 0 LLM]
Cheap Relevance Filter (Rule Scorer + pgvector matchSubset, bounded to AI_MATCH_MAX_JOBS_PER_RUN)
  │
  ▼ [AI Cache Lookup (ai_match_evaluations)]
Cache Hit? ──Yes──► Reuse Cached Evaluation (0 LLM call)
  │ No
  ▼ [SumoPod AI completion]
LLM Recommendation Evaluator (Score, Strengths, Gaps, Summary, Category)
  │
  ▼
Persist Evaluation Cache & Update Run Detail Telemetry
```

---

## 3. Detailed Component Specifications

### 3.1. Zero-LLM Scraping & Ingestion
- Scrapers, parsers, and normalizers must contain zero LLM imports or calls:
  - Scraper adapters (`JobstreetBrowserAdapter`, etc.) extract title, company, location, salary, date, and description using Cheerio / DOM selectors.
  - Date parsing and employment type parsing use deterministic helper functions.
  - URL canonicalization and checksumming use SHA-256 digests.
  - Ingestion deduplicates by URL and checksum against the database.
- Unit and integration tests verify that scraping never invokes LLM services.

### 3.2. Pre-LLM Deterministic Filter (`PreLlmJobFilter`)
A dedicated service/function evaluating newly ingested or candidate jobs against candidate preferences:
1. **Posting Age:** Rejects jobs older than `preferences.maxPostingAgeDays` (or default 30 days).
2. **Selected Source:** Rejects jobs from disabled sources.
3. **Preferred Location:** Rejects jobs outside preferred locations (if specified).
4. **Excluded Roles:** Rejects jobs whose title matches any case-insensitive regex/string in `preferences.excludedRoles`.
5. **Employment Type:** Rejects jobs mismatching candidate employment type preferences (if specified).
6. **Active Status:** Rejects expired, closed, or soft-deleted jobs.
7. **Duplicates:** Skips duplicates or jobs previously dismissed.

### 3.3. Cheap Relevance Filter & Bounding
To protect AI token consumption and avoid low-relevance LLM evaluations:
- **Rule Scoring:** Evaluates candidate skills & headline against job title & skills using `scoreJob` (deterministic rule-based match).
- **Vector Search:** Performs `matchSubset` using candidate profile embedding against eligible job embeddings.
- **Configurable Env Limits:**
  - `AI_MATCH_MAX_JOBS_PER_RUN` (default: 20)
  - `AI_MATCH_MIN_VECTOR_SCORE` (default: 0.60)
  - `AI_MATCH_MIN_RULE_SCORE` (default: 60)
- Only jobs exceeding thresholds are selected, sorted by relevance score descending, capped strictly at `AI_MATCH_MAX_JOBS_PER_RUN`.

### 3.4. LLM Recommendation Evaluator & Schema
- Update `backend/src/matching/llm-evaluator.ts` schema:
  ```typescript
  export const conciseAiMatchSchema = z.object({
    score: z.number().int().min(0).max(100),
    recommendation: z.enum(['strong_match', 'recommended', 'potential_match', 'low_match']),
    strengths: z.array(z.string().trim().min(1).max(160)).max(3),
    gaps: z.array(z.string().trim().min(1).max(160)).max(3),
    summary: z.string().trim().min(1).max(280),
  }).strict();
  ```
- **Category Display Mapping:**
  - `strong_match` -> `"Strong Match"`
  - `recommended` -> `"Recommended"`
  - `potential_match` -> `"Potential Match"`
  - `low_match` -> `"Low Match"`
- **Domain-Agnostic Prompt:** Evaluates technical (e.g. Software Engineer, Data Scientist) and non-technical profiles (e.g. Accountant, Operations Manager, Marketing Lead, Legal Counsel) objectively using provided factual skills, experiences, and requirements.

### 3.5. AI Evaluation Cache (`EvaluationCacheRepository`)
- Uses table `ai_match_evaluations`.
- Cache key:
  - `candidate_id`
  - `profile_checksum`
  - `job_checksum`
  - `prompt_version` (e.g. `'job-match-v3'`)
  - `model` (e.g. `'configured'`)
- Cache hit skips LLM completely and returns cached score/summary/strengths/gaps.
- Cache miss invokes LLM, parses response, and saves record to cache table.

### 3.6. Run Telemetry & Safe Metrics
Expand `SearchExecutionSummary` in `backend/src/search/search-execution.repository.ts`:
```typescript
export interface SearchExecutionSummary {
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  filteredOut: number;
  afterDeterministicFilters?: number;
  consideredForMatching?: number;
  sentToLlm?: number;
  aiCacheHits?: number;
  aiCacheMisses?: number;
  recommendationsProduced?: number;
  aiEvaluated: number;
  aiFailed: number;
}
```
Expose and render these in `SearchRunDetailView.vue` with clear visual distinction showing:
1. **Scraping & Ingestion Stage:** 0 AI calls, 100% deterministic.
2. **Filtering Stage:** Deterministic age, location, and role exclusion metrics.
3. **AI Recommendation Stage:** Bounded LLM calls, cache hit rate, and produced recommendations with `✦ AI` badge.

---

## 4. Test Strategy

1. **Scraper Zero-LLM Test:** Verify mock and real scraper adapters execute without injecting or calling any LLM service.
2. **Deterministic Pre-Filter Unit Tests:**
   - Test age filter rejects older jobs.
   - Test excluded roles filter rejects matching titles (e.g., "Senior Manager" when excluded).
   - Test location and employment type filtering.
3. **Cheap Relevance & Bounding Tests:**
   - Test jobs below min rule score or min vector score are pruned before LLM.
   - Test candidate set is capped at `AI_MATCH_MAX_JOBS_PER_RUN`.
4. **Cache Reusability Tests:**
   - First run evaluates and caches.
   - Second run with same candidate & job checksums hits cache without invoking LLM mock.
5. **Multi-Domain LLM Evaluation Tests:**
   - Test recommendation generation on a technical profile (Backend Developer).
   - Test recommendation generation on a non-technical profile (Operations Specialist / Accountant).
6. **Regression Verification:** Full test suite, TypeScript typecheck, and build across `backend` and `frontend`.
