# AI Token Usage Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound and cache LLM-based job matching so each search execution evaluates only its eligible, deterministically ranked Top-N jobs with compact context and visible usage metrics.

**Architecture:** Scrape runs return eligible execution-scoped job IDs after freshness and hard eligibility checks. A subset-aware pgvector query ranks those IDs, deterministic scoring enforces the rule threshold, and a configured Top-N goes through a candidate-owned persistent evaluation cache before any LLM call. Search execution JSON summaries carry backward-compatible usage metrics that the existing Run Detail view renders.

**Tech Stack:** Node.js, strict TypeScript, Express, Zod, Supabase PostgreSQL/RLS/pgvector, Vue 3, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-09-24-ai-token-usage-optimization-design.md`

## Global Constraints

- Keep the exact pipeline order: scrape, normalize, deduplicate, freshness, eligibility, embedding similarity, rule score, Top-N, LLM.
- Never send source CV Markdown, raw scraper payloads, HTML, or full descriptions to the LLM.
- Never call application material generators during discovery.
- Defaults are `AI_MATCH_MAX_JOBS_PER_RUN=20`, `AI_MATCH_MIN_VECTOR_SCORE=0.60`, and `AI_MATCH_MIN_RULE_SCORE=60`.
- Remote Supabase migrations require explicit user approval before execution.
- All exposed tables require candidate-owned RLS; update policies require both `USING` and `WITH CHECK`.
- New behavior follows strict red-green-refactor TDD.
- Preserve unrelated dirty worktree changes and do not push or create a PR without approval.

## Review Focus

- Duplicate job IDs returned by multiple sources must be counted and evaluated once; Task 4 tests unique ID aggregation.
- A shortlist containing mixed cache hits, misses, and provider failures must produce exact metrics without dropping deterministic results; Task 5 tests this mixture.
- Legacy `search_executions.summary` objects with missing metric keys must map safely to zero; Task 6 tests repository mapping.
- Compacting descriptions with unknown headings or oversized text must stay bounded and deterministic; Task 2 tests fallback and maximum lengths.
- Concurrent cache misses for the same identity must converge through the unique index/upsert without exposing another candidate's row; Task 3 tests identity and ownership SQL.

---

### Task 1: Centralized AI Matching Policy

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`
- Test: `backend/tests/unit/config/ai-env.test.ts`

**Interfaces:**
- Consumes: `loadEnv(input: NodeJS.ProcessEnv): AppEnv`.
- Produces: `AiMatchingPolicy` and `AppEnv.aiMatchingPolicy` with `maxJobsPerRun`, `minVectorScore`, and `minRuleScore`.

- [ ] **Step 1: Write failing configuration tests**

Add tests that assert defaults, explicit values, and rejected bounds:

```ts
expect(loadEnv(base).aiMatchingPolicy).toEqual({
  maxJobsPerRun: 20,
  minVectorScore: 0.6,
  minRuleScore: 60,
});

expect(loadEnv({
  ...base,
  AI_MATCH_MAX_JOBS_PER_RUN: '7',
  AI_MATCH_MIN_VECTOR_SCORE: '0.72',
  AI_MATCH_MIN_RULE_SCORE: '68',
}).aiMatchingPolicy).toEqual({ maxJobsPerRun: 7, minVectorScore: 0.72, minRuleScore: 68 });

expect(() => loadEnv({ ...base, AI_MATCH_MAX_JOBS_PER_RUN: '0' })).toThrow('AI_MATCH_MAX_JOBS_PER_RUN');
expect(() => loadEnv({ ...base, AI_MATCH_MIN_VECTOR_SCORE: '1.1' })).toThrow('AI_MATCH_MIN_VECTOR_SCORE');
expect(() => loadEnv({ ...base, AI_MATCH_MIN_RULE_SCORE: '-1' })).toThrow('AI_MATCH_MIN_RULE_SCORE');
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `cd backend && bun test tests/unit/config/ai-env.test.ts`

Expected: FAIL because `aiMatchingPolicy` does not exist and the new environment keys are not validated.

- [ ] **Step 3: Implement the typed policy**

Add this public type and schema fields in `env.ts`:

```ts
export type AiMatchingPolicy = {
  maxJobsPerRun: number;
  minVectorScore: number;
  minRuleScore: number;
};

AI_MATCH_MAX_JOBS_PER_RUN: z.coerce.number().int().min(1).max(100).default(20),
AI_MATCH_MIN_VECTOR_SCORE: z.coerce.number().min(-1).max(1).default(0.60),
AI_MATCH_MIN_RULE_SCORE: z.coerce.number().min(0).max(100).default(60),
```

Return one object from `loadEnv`:

```ts
aiMatchingPolicy: {
  maxJobsPerRun: result.data.AI_MATCH_MAX_JOBS_PER_RUN,
  minVectorScore: result.data.AI_MATCH_MIN_VECTOR_SCORE,
  minRuleScore: result.data.AI_MATCH_MIN_RULE_SCORE,
},
```

Add the three documented defaults to `backend/.env.example` without adding secrets.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `cd backend && bun test tests/unit/config/ai-env.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the policy**

```powershell
git add backend/src/config/env.ts backend/tests/unit/config/ai-env.test.ts backend/.env.example
git commit -m "feat(ai): configure bounded matching policy"
```

---

### Task 2: Compact Matching Contexts and Concise AI Schema

**Files:**
- Create: `backend/src/matching/context/candidate-match-context.ts`
- Create: `backend/src/matching/context/job-match-context.ts`
- Modify: `backend/src/matching/llm-evaluator.ts`
- Modify: `docs/prompts/job-matching.md`
- Test: `backend/tests/unit/matching/match-context.test.ts`
- Test: `backend/tests/unit/matching/llm-parser.test.ts`

**Interfaces:**
- Consumes: `CandidateSearchProfile`, normalized job fields, normalized job skills, `RuleScore`, and `LlmService.completeJson`.
- Produces: `CandidateMatchContext`, `JobMatchContext`, `buildCandidateMatchContext`, `buildJobMatchContext`, `AI_MATCH_PROMPT_VERSION`, and concise `AiMatchAnalysis`.

- [ ] **Step 1: Write failing compact-context tests**

Create tests proving only allowed fields are emitted and text is bounded:

```ts
const candidate = buildCandidateMatchContext(searchProfile);
expect(candidate).toEqual({
  targetRoles: ['Backend Engineer'],
  skills: ['typescript', 'postgresql'],
  experienceYears: 4,
  seniority: ['mid'],
  industries: ['fintech'],
  preferredLocations: ['Jakarta'],
  workModes: ['hybrid'],
  employmentTypes: ['full-time'],
});
expect(JSON.stringify(candidate)).not.toContain('excludedCompanies');

const job = buildJobMatchContext({
  title: 'Backend Engineer', companyName: 'Acme',
  description: 'Responsibilities:\nBuild APIs.\nRequirements:\nTypeScript and 3 years experience.\n'.repeat(100),
  location: 'Jakarta', employmentType: 'full-time', workplaceType: 'hybrid',
}, [{ displayName: 'TypeScript', canonicalName: 'typescript', matchMethod: 'keyword' }]);
expect(job.requirements.length).toBeLessThanOrEqual(1200);
expect(job.responsibilities.length).toBeLessThanOrEqual(1200);
expect(job.experienceRequirement).toContain('3 years');
expect(JSON.stringify(job)).not.toContain('<html');
```

Add a fallback test with no recognized headings and assert the bounded text appears only in `responsibilities`.

- [ ] **Step 2: Run context tests and verify RED**

Run: `cd backend && bun test tests/unit/matching/match-context.test.ts`

Expected: FAIL because the builders do not exist.

- [ ] **Step 3: Implement deterministic context builders**

Use explicit contracts and limits:

```ts
export type CandidateMatchContext = {
  targetRoles: string[];
  skills: string[];
  experienceYears?: number;
  seniority: string[];
  industries: string[];
  preferredLocations: string[];
  workModes: string[];
  employmentTypes: string[];
};

export type JobMatchContext = {
  title: string;
  company: string;
  requirements: string;
  responsibilities: string;
  skills: string[];
  experienceRequirement?: string;
  location?: string;
  employmentType?: string;
  workplaceType?: string;
};
```

Normalize whitespace, strip tags, cap target roles at 10, skills at 40, other arrays at 10, title/company/location at 200 characters, and requirements/responsibilities at 1,200 characters. Extract sections using case-insensitive Indonesian and English headings (`requirements`, `qualifications`, `kualifikasi`, `responsibilities`, `duties`, `tanggung jawab`). Extract the first bounded sentence containing a year/experience expression.

- [ ] **Step 4: Run context tests and verify GREEN**

Run: `cd backend && bun test tests/unit/matching/match-context.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing concise-output tests**

Update `llm-parser.test.ts` to require the new schema:

```ts
const completeJson = vi.fn().mockResolvedValue({
  score: 82,
  recommendation: 'strong_match',
  strengths: ['Strong TypeScript'],
  gaps: ['No AWS evidence'],
  summary: 'Good fit for the core backend responsibilities.',
});
const result = await evaluateJobMatch(
  { completeJson } as never,
  candidateContext,
  jobContext,
  ruleScore,
  'model-x',
);
expect(result).toMatchObject({ status: 'ready', score: 82, gaps: ['No AWS evidence'] });
expect(completeJson).toHaveBeenCalledWith(expect.objectContaining({ model: 'model-x' }), expect.anything());
```

Add rejection/failure cases for four strengths, four gaps, an over-280-character summary, unknown keys, and invalid recommendation.

- [ ] **Step 6: Run evaluator tests and verify RED**

Run: `cd backend && bun test tests/unit/matching/llm-parser.test.ts`

Expected: FAIL because the evaluator still accepts the old `match_score`/`missing_skills` schema and string contexts.

- [ ] **Step 7: Implement the versioned structured evaluator**

Export:

```ts
export const AI_MATCH_PROMPT_VERSION = 'job-match-v2';
```

Define a strict Zod schema:

```ts
const analysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(['strong_match', 'potential_match', 'weak_match']),
  strengths: z.array(z.string().trim().min(1).max(160)).max(3),
  gaps: z.array(z.string().trim().min(1).max(160)).max(3),
  summary: z.string().trim().min(1).max(280),
}).strict();
```

Change `evaluateJobMatch` to accept structured contexts and send one JSON user message containing `promptVersion`, `candidate`, `job`, and a compact deterministic score projection. Keep provider errors mapped to the existing safe failed state.

- [ ] **Step 8: Run evaluator tests and verify GREEN**

Run: `cd backend && bun test tests/unit/matching/llm-parser.test.ts tests/unit/matching/match-context.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit compact contexts**

```powershell
git add backend/src/matching/context backend/src/matching/llm-evaluator.ts backend/tests/unit/matching docs/prompts/job-matching.md
git commit -m "feat(ai): use compact structured match context"
```

---

### Task 3: Candidate-Owned Persistent Evaluation Cache and Subset Vector RPC

**Files:**
- Create: `backend/supabase/migrations/20260924140000_ai_match_evaluation_cache.sql`
- Create: `backend/src/matching/evaluation-cache.repository.ts`
- Modify: `backend/src/matching/matching.repository.ts`
- Modify: `backend/src/infrastructure/supabase/database.types.ts`
- Create: `backend/tests/unit/matching/evaluation-cache.repository.test.ts`
- Modify: `backend/tests/unit/matching/vector-search.test.ts`
- Create: `backend/tests/integration/database/ai-match-cache-schema.test.ts`

**Interfaces:**
- Consumes: candidate ID, execution job IDs, profile checksum, job checksum, prompt version, model, and `AiMatchAnalysis`.
- Produces: `EvaluationCacheIdentity`, `EvaluationCacheRepository.get/save`, and `MatchingRepository.matchSubset(candidateId, embedding, jobIds, limit, threshold)`.

- [ ] **Step 1: Verify current Supabase guidance before SQL work**

Read the current Supabase changelog and official RLS/index documentation required by the project Supabase skill. Run `bunx supabase --version` and `bunx supabase --help`; do not apply a remote migration.

- [ ] **Step 2: Write failing static schema tests**

Assert the migration contains:

```ts
expect(sql).toContain('create table public.ai_match_evaluations');
expect(sql).toContain('unique (candidate_id, profile_checksum, job_checksum, prompt_version, model)');
expect(sql).toContain('alter table public.ai_match_evaluations enable row level security');
expect(sql).toMatch(/for update to authenticated[\s\S]*using[\s\S]*with check/i);
expect(sql).toContain('security invoker');
expect(sql).toContain('p_job_ids uuid[]');
expect(sql).toContain('jobs.id = any(p_job_ids)');
expect(sql).toContain('auth.uid() = p_candidate_id');
expect(sql).toContain('limit least(greatest(p_match_count, 1), 200)');
```

- [ ] **Step 3: Run schema tests and verify RED**

Run: `cd backend && bun test tests/integration/database/ai-match-cache-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 4: Write the cache migration and subset RPC**

Create `ai_match_evaluations` with the columns and constraints from the spec, an ownership lookup index on `(candidate_id, job_id, updated_at desc)`, and a named unique constraint for cache upsert. Grant only `select, insert, update, delete` to `authenticated`, enable RLS, and create candidate-owned policies.

Create `public.match_candidate_job_subset(p_candidate_id uuid, p_query_embedding extensions.vector(1536), p_job_ids uuid[], p_match_threshold double precision default 0, p_match_count integer default 20)` as `language sql stable security invoker set search_path = ''`. Revoke execute from `public`, grant to `authenticated`, and return no rows for an empty array.

- [ ] **Step 5: Run schema tests and verify GREEN**

Run: `cd backend && bun test tests/integration/database/ai-match-cache-schema.test.ts tests/integration/database/matching-schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Write failing cache repository tests**

Test exact candidate-scoped identity lookup and conflict-safe save:

```ts
await repo.get({
  candidateId: 'candidate-1', profileChecksum: 'a'.repeat(64),
  jobChecksum: 'b'.repeat(64), promptVersion: 'job-match-v2', model: 'model-x',
});
expect(query.eq).toHaveBeenCalledWith('candidate_id', 'candidate-1');

await repo.save(identity, 'job-1', readyAnalysis);
expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
  candidate_id: 'candidate-1', job_id: 'job-1', evaluation: readyAnalysis,
}), { onConflict: 'candidate_id,profile_checksum,job_checksum,prompt_version,model' });
```

Add a test proving a missing row returns `null` and provider failures are never passed to `save` by its typed signature.

- [ ] **Step 7: Run cache repository tests and verify RED**

Run: `cd backend && bun test tests/unit/matching/evaluation-cache.repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 8: Implement the cache repository**

Define:

```ts
export type EvaluationCacheIdentity = {
  candidateId: string;
  profileChecksum: string;
  jobChecksum: string;
  promptVersion: string;
  model: string;
};

export interface EvaluationCacheRepository {
  get(identity: EvaluationCacheIdentity): Promise<Extract<AiMatchAnalysis, { status: 'ready' }> | null>;
  save(identity: EvaluationCacheIdentity, jobId: string, evaluation: Extract<AiMatchAnalysis, { status: 'ready' }>): Promise<void>;
}
```

Validate cached JSON with the same exported evaluation schema before returning it. Treat invalid stored JSON as a cache miss, never as trusted domain data.

- [ ] **Step 9: Write failing subset vector tests**

Extend vector repository/service tests to assert `match_candidate_job_subset` receives candidate ID, unique job IDs, threshold, and bounded count, and that an empty job list avoids the RPC.

- [ ] **Step 10: Run subset vector tests and verify RED**

Run: `cd backend && bun test tests/unit/matching/vector-search.test.ts`

Expected: FAIL because `matchSubset` is absent.

- [ ] **Step 11: Implement subset matching and update database types**

Add `matchSubset` to `MatchingRepository` and make `VectorSearchService.searchSubset(candidateId, jobIds, requestedLimit, threshold)` deduplicate IDs, return immediately for an empty list, and enforce its existing 200-row ceiling.

Update generated types only from a verified schema. If the remote project has not yet been approved for migration, keep this task's migration/type regeneration checkpoint open; do not fabricate remote state. After explicit approval, apply the reviewed migration using the project's Supabase workflow, run advisors, and execute `cd backend && bun run db:types`.

- [ ] **Step 12: Run repository/vector tests and verify GREEN**

Run: `cd backend && bun test tests/unit/matching/evaluation-cache.repository.test.ts tests/unit/matching/vector-search.test.ts tests/integration/database/ai-match-cache-schema.test.ts`

Expected: PASS.

- [ ] **Step 13: Commit persistence work**

```powershell
git add backend/supabase/migrations/20260924140000_ai_match_evaluation_cache.sql backend/src/matching backend/src/infrastructure/supabase/database.types.ts backend/tests/unit/matching backend/tests/integration/database/ai-match-cache-schema.test.ts
git commit -m "feat(ai): persist cached match evaluations"
```

---

### Task 4: Apply Freshness and Eligibility Before Embedding

**Files:**
- Modify: `backend/src/scraping/scraper.interface.ts`
- Modify: `backend/src/scraping/scraper.orchestrator.ts`
- Modify: `backend/src/search/candidate-search.service.ts`
- Modify: `backend/tests/unit/scraping/orchestrator.test.ts`
- Modify: `backend/tests/unit/search/candidate-search-service.test.ts`

**Interfaces:**
- Consumes: `CandidateSearchProfile`, `applyHardFilters`, normalized scraper fields, and the existing embedding runner.
- Produces: `ScrapeSummary.eligibleJobIds`, `ScrapeSummary.jobsSentToEmbedding`, and an optional `ScrapeRequest.eligibilityProfile`.

- [ ] **Step 1: Write failing orchestrator tests**

Add tests proving an excluded company and stale job are persisted but never embedded, an eligible changed job is embedded and returned, and an eligible duplicate is returned without embedding:

```ts
expect(summary.eligibleJobIds).toEqual(['eligible-new', 'eligible-duplicate']);
expect(summary.jobsSentToEmbedding).toBe(1);
expect(embed).toHaveBeenCalledTimes(1);
expect(embed).toHaveBeenCalledWith('eligible-new');
```

Use two sources that return the same job ID in candidate-search tests and assert the later aggregate has one unique ID.

- [ ] **Step 2: Run orchestrator/search tests and verify RED**

Run: `cd backend && bun test tests/unit/scraping/orchestrator.test.ts tests/unit/search/candidate-search-service.test.ts`

Expected: FAIL because summaries do not carry IDs/counts and eligibility is not applied.

- [ ] **Step 3: Implement pre-embedding filters and metrics**

Extend `ScrapeSummary`:

```ts
eligibleJobIds: string[];
jobsSentToEmbedding: number;
ineligible: number;
```

After ingestion, evaluate freshness and `applyHardFilters` for every scraped job. Add an eligible job ID regardless of `changed`; increment embedding count immediately before each provider attempt only when `changed` is true. Do not embed ineligible or stale jobs.

Resolve/pass the same persisted candidate search profile for manual and scheduled searches. Preserve per-source summary persistence without storing raw ID arrays in `scrape_runs`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd backend && bun test tests/unit/scraping/orchestrator.test.ts tests/unit/search/candidate-search-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit filter ordering**

```powershell
git add backend/src/scraping backend/src/search/candidate-search.service.ts backend/tests/unit/scraping backend/tests/unit/search/candidate-search-service.test.ts
git commit -m "feat(search): filter execution jobs before embedding"
```

---

### Task 5: Bounded Rule Ranking, Cache Reuse, and LLM Metrics

**Files:**
- Modify: `backend/src/services/matching-service.ts`
- Modify: `backend/src/matching/matching.repository.ts`
- Modify: `backend/src/matching/vector-search.service.ts`
- Create: `backend/tests/unit/services/matching-service.test.ts`

**Interfaces:**
- Consumes: `AiMatchingPolicy`, execution job IDs, compact contexts/checksums, subset vector search, scorer, cache repository, evaluator, model, and prompt version.
- Produces: `MatchingRunResult { recommendations, metrics }` with exact jobs-considered/cache/LLM counters.

- [ ] **Step 1: Write failing pipeline tests**

Create tests for threshold order and Top-N:

```ts
const result = await service.recommendSubset('candidate-1', ['job-low-vector', 'job-low-rule', 'job-a', 'job-b', 'job-c']);
expect(getJobContext).not.toHaveBeenCalledWith('candidate-1', 'job-low-vector');
expect(cache.get).not.toHaveBeenCalledWith(expect.objectContaining({ jobChecksum: 'low-rule' }));
expect(evaluate).toHaveBeenCalledTimes(2); // configured Top-N = 2
expect(result.metrics.jobsConsidered).toBe(4); // rows returned by vector search
```

Add a mixed test with one cache hit, one successful miss, and one failed miss:

```ts
expect(result.metrics).toEqual({
  jobsConsidered: 3,
  jobsSentToLlm: 2,
  aiCacheHits: 1,
  aiCacheMisses: 2,
  aiEvaluated: 2,
  aiFailed: 1,
});
expect(cache.save).toHaveBeenCalledTimes(1);
expect(result.recommendations).toHaveLength(3);
```

Add separate profile/job/prompt/model checksum identity tests and assert each changed identity causes a miss.

- [ ] **Step 2: Run matching-service tests and verify RED**

Run: `cd backend && bun test tests/unit/services/matching-service.test.ts`

Expected: FAIL because `recommendSubset` and metrics do not exist.

- [ ] **Step 3: Expand repository context contracts**

Return exact types:

```ts
type CandidateMatchingData = {
  context: CandidateMatchContext;
  scoring: CandidateScoringInput;
  profileChecksum: string;
};

type JobMatchingData = {
  jobId: string;
  context: JobMatchContext;
  scoring: JobScoringInput;
  jobChecksum: string;
};
```

Load candidate compact data from `candidate_search_profiles.profile_data` and join the active profile to `profile_documents.checksum`. Load only normalized job fields, `content_checksum`, and skills for job contexts.

- [ ] **Step 4: Implement bounded matching pipeline**

Define:

```ts
export type MatchingUsageMetrics = {
  jobsConsidered: number;
  jobsSentToLlm: number;
  aiCacheHits: number;
  aiCacheMisses: number;
  aiEvaluated: number;
  aiFailed: number;
};

export type MatchingRunResult = {
  recommendations: MatchingRecommendation[];
  metrics: MatchingUsageMetrics;
};
```

`recommendSubset` must call subset vector search with the configured vector threshold, load/score only returned rows, discard rule scores below policy, sort by rule score then similarity, slice Top-N, then perform sequential cache lookup/evaluation. Cache only ready evaluations. Preserve deterministic fallback recommendation for failures.

Keep `recommend(candidateId, limit, threshold)` for the existing endpoint, but clamp `limit` to policy maximum and clamp `threshold` upward to policy minimum; delegate through the same shortlist/cache code.

- [ ] **Step 5: Run matching tests and verify GREEN**

Run: `cd backend && bun test tests/unit/services/matching-service.test.ts tests/unit/matching/vector-search.test.ts tests/unit/matching/llm-parser.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit bounded matching**

```powershell
git add backend/src/services/matching-service.ts backend/src/matching backend/tests/unit/services/matching-service.test.ts backend/tests/unit/matching
git commit -m "feat(ai): bound and cache match evaluation"
```

---

### Task 6: Execute Matching During Discovery and Persist Accurate Metrics

**Files:**
- Modify: `backend/src/search/search-execution.repository.ts`
- Modify: `backend/src/search/candidate-search.service.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/unit/search/candidate-search-execution.test.ts`
- Modify: `backend/tests/unit/search/search-execution-repository.test.ts`
- Modify: `backend/tests/unit/search/candidate-search-service.test.ts`

**Interfaces:**
- Consumes: Task 4 aggregate `eligibleJobIds/jobsSentToEmbedding` and Task 5 `MatchingService.recommendSubset`.
- Produces: extended `SearchExecutionSummary` and real matching stage/timeline status.

- [ ] **Step 1: Write failing execution tests**

Inject a matching dependency and assert it receives the unique eligible IDs after all sources finish:

```ts
expect(matching.recommendSubset).toHaveBeenCalledWith('candidate-1', ['job-a', 'job-b']);
expect(finish).toHaveBeenCalledWith('candidate-1', 'exec-1', expect.objectContaining({
  summary: expect.objectContaining({
    jobsConsidered: 2,
    jobsSentToEmbedding: 1,
    jobsSentToLlm: 1,
    aiCacheHits: 1,
    aiCacheMisses: 1,
  }),
}));
```

Add a test where matching is never called because no eligible IDs exist and the AI stage becomes `skipped` with zero counts and an explicit `No eligible jobs` detail. Add a provider-failure test that produces `partial` and `aiFailed: 1` without changing ingestion counts.

- [ ] **Step 2: Write failing legacy-summary repository test**

Map a database row whose summary contains only old keys and assert:

```ts
expect(record.summary).toMatchObject({
  jobsConsidered: 0,
  jobsSentToEmbedding: 0,
  jobsSentToLlm: 0,
  aiCacheHits: 0,
  aiCacheMisses: 0,
});
```

- [ ] **Step 3: Run execution/repository tests and verify RED**

Run: `cd backend && bun test tests/unit/search/candidate-search-execution.test.ts tests/unit/search/search-execution-repository.test.ts tests/unit/search/candidate-search-service.test.ts`

Expected: FAIL because the service uses synthetic AI stage counts and the new fields do not exist.

- [ ] **Step 4: Extend summary mapping and discovery orchestration**

Add the five metrics to `SearchExecutionSummary`, initial summary, final summary, and fallback mapping. Merge stored JSON over a complete zero-valued default instead of returning stored JSON directly. Extend `SearchExecutionStage.status` and `updateStage` with `skipped` so an empty shortlist is not represented as successful AI work.

Inject `Pick<MatchingService, 'recommendSubset'>` into `CandidateSearchService`. After all source runs, deduplicate eligible IDs, start the matching stage, invoke matching once, and persist returned metrics. Mark the stage `failed` only for fatal matching setup errors; individual AI evaluation failures produce a completed stage with warning details and a `partial` parent status.

- [ ] **Step 5: Wire dependencies in `server.ts`**

Create one candidate-scoped matching service factory that injects:

```ts
new DefaultMatchingService(
  new VectorSearchService(repository, { maxLimit: 200 }),
  repository,
  new SupabaseEvaluationCacheRepository(client),
  new LlmService(provider),
  env.aiChatModel,
  env.aiMatchingPolicy,
)
```

Use it for both the matching endpoint and candidate search service. Do not construct or inject `ApplicationAssistantService` into discovery.

- [ ] **Step 6: Run execution/repository tests and verify GREEN**

Run: `cd backend && bun test tests/unit/search/candidate-search-execution.test.ts tests/unit/search/search-execution-repository.test.ts tests/unit/search/candidate-search-service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit discovery integration**

```powershell
git add backend/src/search backend/src/server.ts backend/tests/unit/search
git commit -m "feat(search): record bounded AI matching usage"
```

---

### Task 7: Matching API Bounds and Application Boundary

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/integration/api/matching.test.ts`
- Modify: `backend/tests/unit/search/candidate-search-execution.test.ts`
- Modify: `backend/tests/integration/api/applications.test.ts`

**Interfaces:**
- Consumes: shared policy-bound `MatchingService.recommend` and existing application routes.
- Produces: backward-compatible matching response with concise AI analysis and proof that discovery cannot generate application materials.

- [ ] **Step 1: Write failing matching API tests**

Assert a caller requesting `limit=200&threshold=0` still delegates to the policy-bound service and returns the new concise analysis fields:

```ts
expect(response.body[0].ai_analysis).toMatchObject({
  status: 'ready', score: 82, recommendation: 'strong_match', gaps: [],
});
expect(response.body[0].ai_analysis).not.toHaveProperty('missingSkills');
```

Keep authentication and candidate-ownership tests.

- [ ] **Step 2: Add a discovery/application isolation test**

Construct candidate discovery with an application assistant spy that throws if called, complete one search, and assert all material methods have zero calls:

```ts
expect(generateCoverLetter).not.toHaveBeenCalled();
expect(generateIntroduction).not.toHaveBeenCalled();
expect(generateRecruiterAnswer).not.toHaveBeenCalled();
```

Retain application endpoint tests proving those generators are called only by their explicit routes.

- [ ] **Step 3: Run API/boundary tests and verify RED**

Run: `cd backend && bun test tests/integration/api/matching.test.ts tests/integration/api/applications.test.ts tests/unit/search/candidate-search-execution.test.ts`

Expected: FAIL on old analysis shape or missing isolation fixture.

- [ ] **Step 4: Update API serialization and dependency boundaries**

Serialize the new `AiMatchAnalysis` without prompts, contexts, raw provider responses, or cache identities. Keep deterministic score fields. Ensure `CandidateSearchService`'s constructor type has no application-assistant dependency.

- [ ] **Step 5: Run API/boundary tests and verify GREEN**

Run: `cd backend && bun test tests/integration/api/matching.test.ts tests/integration/api/applications.test.ts tests/unit/search/candidate-search-execution.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit API boundaries**

```powershell
git add backend/src/app.ts backend/tests/integration/api backend/tests/unit/search/candidate-search-execution.test.ts
git commit -m "test(ai): enforce matching and application boundaries"
```

---

### Task 8: Run Detail AI Usage Metrics

**Files:**
- Modify: `frontend/src/types/search-execution.ts`
- Modify: `frontend/src/views/SearchRunDetailView.vue`
- Modify: `frontend/src/views/__tests__/SearchRunDetailView.test.ts`

**Interfaces:**
- Consumes: extended API `SearchExecutionSummary`.
- Produces: backward-compatible `AiUsageMetrics` presentation in Run Detail.

- [ ] **Step 1: Load required UI skills before editing**

Read `antislop`, `antislop-ui`, `antislop-human`, and `antislop-layoutmobile`. Ask the user whether antislop applies DURING implementation or as an AFTER audit, then follow the selected mode. Do not edit the component before this choice.

- [ ] **Step 2: Write failing Run Detail tests**

Extend the sample execution and assert all safe metrics render:

```ts
summary: {
  ...existingSummary,
  jobsConsidered: 8,
  jobsSentToEmbedding: 3,
  jobsSentToLlm: 2,
  aiCacheHits: 4,
  aiCacheMisses: 2,
}
```

```ts
expect(wrapper.get('[data-test="ai-usage-metrics"]').text()).toContain('8');
expect(wrapper.text()).toContain('Sent to embedding');
expect(wrapper.text()).toContain('Sent to LLM');
expect(wrapper.text()).toContain('Cache hits');
expect(wrapper.text()).toContain('Cache misses');
```

Add a legacy fixture with the five fields absent and assert zero values render without errors.

Add a stage fixture with `status: 'skipped'` and assert it renders a neutral `Skipped` state without a success icon.

- [ ] **Step 3: Run frontend view test and verify RED**

Run: `cd frontend && bun test src/views/__tests__/SearchRunDetailView.test.ts`

Expected: FAIL because the types and UI do not expose the new metrics.

- [ ] **Step 4: Implement typed, responsive AI Usage section**

Add optional metric fields to the frontend summary type for legacy compatibility and add `skipped` to the stage-status union. In the view, normalize each metric with `?? 0`, render skipped stages neutrally, and render one compact AI Usage section using the existing editorial visual language. Use a responsive two-column/five-item layout without inventing new colors, decorative assets, or unsupported claims. Label embedding and LLM separately so the user can distinguish cheap vector work from completion calls.

- [ ] **Step 5: Run frontend view tests and verify GREEN**

Run: `cd frontend && bun test src/views/__tests__/SearchRunDetailView.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Run Detail metrics**

```powershell
git add frontend/src/types/search-execution.ts frontend/src/views/SearchRunDetailView.vue frontend/src/views/__tests__/SearchRunDetailView.test.ts
git commit -m "feat(frontend): show AI usage per search run"
```

---

### Task 9: Documentation, Decision Record, and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `docs/decisions/003-cache-ai-match-evaluations.md`
- Modify: `docs/prompts/job-matching.md`

**Interfaces:**
- Consumes: completed configuration, pipeline, cache, metrics, and UI behavior.
- Produces: accurate operational documentation and final verification evidence.

- [ ] **Step 1: Update operational documentation**

Document the three environment controls, execution-scoped flow, cache identity, metric definitions, prompt version, and remote migration approval requirement. Update repository status so the implemented optimization is no longer described as future work.

- [ ] **Step 2: Record the cache decision**

The ADR must state:

```text
Decision: Persist candidate-owned LLM job-match evaluations.
Identity: profile checksum + job checksum + prompt version + model.
Reason: unchanged semantic inputs must not consume repeat completion tokens.
Invalidation: identity changes create misses; old rows remain auditable and are cascade-deleted with candidate/job ownership.
Rejected: in-memory-only cache and job-row-only evaluation columns.
```

- [ ] **Step 3: Run focused backend tests**

Run:

```powershell
cd backend
bun test tests/unit/config/ai-env.test.ts tests/unit/matching tests/unit/services/matching-service.test.ts tests/unit/scraping/orchestrator.test.ts tests/unit/search tests/integration/api/matching.test.ts tests/integration/api/applications.test.ts tests/integration/database/ai-match-cache-schema.test.ts
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 4: Run full backend verification**

Run:

```powershell
cd backend
bun test
bun run typecheck
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Run full frontend verification**

Run:

```powershell
cd frontend
bun test
bun run typecheck
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Run repository-level verification**

Run from repository root:

```powershell
bun test
bun run typecheck
bun run build
git diff --check
git status --short
```

Expected: tests/typecheck/build exit 0, `git diff --check` emits no errors, and status contains only intentional milestone changes or preserved pre-existing user changes.

- [ ] **Step 7: Verify Supabase without unauthorized remote mutation**

If migration approval was granted and applied, run Supabase security/performance advisors, regenerate database types, and execute an authenticated cache read/write smoke query that cannot see another candidate's rows. If approval was not granted, report the reviewed migration as pending external application and do not claim remote completion.

- [ ] **Step 8: Commit documentation and verification updates**

```powershell
git add README.md AGENTS.md docs/decisions/003-cache-ai-match-evaluations.md docs/prompts/job-matching.md
git commit -m "docs: document AI matching cost controls"
```

- [ ] **Step 9: Request final code review**

Use `superpowers:requesting-code-review` to review the full branch against the approved spec. Address findings with `superpowers:receiving-code-review`, then rerun the full verification commands before reporting completion.
