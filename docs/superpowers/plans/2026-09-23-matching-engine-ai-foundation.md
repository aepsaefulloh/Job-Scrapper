# Matching Engine and AI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-independent intelligence layer that embeds profiles and jobs, performs vector search and deterministic scoring, evaluates a bounded shortlist with structured LLM output, and serves ranked recommendations.

**Architecture:** AI providers are hidden behind embedding and completion interfaces under `src/ai/`. Profile/job text builders and embedding persistence are services, while vector search and rule scoring remain separate matching modules. The API orchestrates the pipeline through `MatchingService`; controllers perform only authentication, validation, and response formatting.

**Tech Stack:** Node.js, TypeScript strict mode, Express, Supabase PostgreSQL, pgvector, Vitest, Zod, native `fetch`.

**Spec:** `docs/superpowers/specs/2026-09-23-matching-engine-ai-foundation-design.md`

## Global Constraints

- Default embedding model is `text-embedding-3-small` with `1536` dimensions.
- Similarity uses cosine distance (`<=>`).
- SumoPod is accessed through an OpenAI-compatible HTTP adapter; business logic never imports a provider SDK.
- LLM calls occur only after vector search and deterministic rule scoring.
- Every exposed Supabase table and RPC enforces candidate ownership through RLS or SQL predicates.
- Provider failures preserve source/profile/job data and expose typed retryable status.
- No scraper, frontend, or auto-apply implementation is included.
- Documentation is written in English.

## Review Focus

- A provider returning the wrong vector length must be rejected before persistence; Task 2 tests this.
- An empty or whitespace-only embedding input must not trigger a provider request; Task 2 tests this.
- A profile or job with a failed embedding must remain searchable as data but excluded from vector results; Tasks 3 and 5 test this.
- A candidate must not search another candidate's jobs even when a valid vector is supplied; Task 5 migration and repository tests pin this.
- Malformed or schema-invalid LLM JSON must preserve deterministic scoring and return a typed AI failure; Task 7 tests this.

---

### Task 1: Add AI configuration and domain error contracts

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Create: `src/ai/ai-errors.ts`
- Create: `tests/unit/config/ai-env.test.ts`

**Interfaces:**
- Consumes: Existing `loadEnv` and `AppEnv`.
- Produces: `AppEnv.aiProvider`, `aiApiKey`, `aiBaseUrl`, `aiChatModel`, `aiEmbeddingModel`, `aiEmbeddingDimensions`; typed `AiConfigurationError`, `EmbeddingValidationError`, `AiProviderError`.

- [ ] **Step 1: Write failing environment tests**

Test valid SumoPod configuration, missing API key rejection, unsupported provider rejection, invalid base URL rejection, and dimensions that are zero or non-integer rejection.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- tests/unit/config/ai-env.test.ts`

Expected: FAIL because AI environment fields are not part of `AppEnv`.

- [ ] **Step 3: Implement strict AI configuration**

Extend the Zod schema with `AI_PROVIDER` defaulting to `sumopod`, required `AI_API_KEY`, required HTTPS `AI_BASE_URL`, required chat model, embedding model defaulting to `text-embedding-3-small`, and positive integer dimensions defaulting to `1536`. Map values into `AppEnv` without logging secrets.

- [ ] **Step 4: Update `.env.example` and run tests/typecheck**

Run: `npm test -- tests/unit/config/ai-env.test.ts` and `npm run typecheck`.

Expected: focused tests pass and typecheck succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/ai/ai-errors.ts tests/unit/config/ai-env.test.ts .env.example
git commit -m "feat: add AI provider configuration"
```

### Task 2: Implement provider-independent embedding service

**Files:**
- Create: `src/ai/embedding/embedding.interface.ts`
- Create: `src/ai/embedding/embedding.service.ts`
- Create: `tests/unit/ai/embedding-service.test.ts`

**Interfaces:**
- Consumes: `AppEnv.aiEmbeddingModel`, `AppEnv.aiEmbeddingDimensions`, and an injected `EmbeddingProvider`.
- Produces: `EmbeddingProvider.embed(request): Promise<EmbeddingResult>` and `EmbeddingService.embedText(text): Promise<EmbeddingResult>`.

```ts
type EmbeddingRequest = { model: string; input: string; dimensions: number };
type EmbeddingResult = { vector: number[]; model: string; dimensions: number };
interface EmbeddingProvider { embed(request: EmbeddingRequest): Promise<EmbeddingResult>; }
```

- [ ] **Step 1: Write failing tests**

Test whitespace rejection without provider invocation, provider response dimension mismatch, model mismatch, and successful validated output.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/unit/ai/embedding-service.test.ts`

Expected: FAIL because the embedding interface/service does not exist.

- [ ] **Step 3: Implement validation-first service**

Reject empty text, call the injected provider with configured model/dimensions, verify vector length and finite numeric values, and return a provider-independent result. Wrap provider exceptions in `AiProviderError` without exposing keys or raw responses.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/ai/embedding-service.test.ts` and `npm run typecheck`.

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/ai/embedding tests/unit/ai/embedding-service.test.ts
git commit -m "feat: add validated embedding service"
```

### Task 3: Add the SumoPod OpenAI-compatible provider and completion abstraction

**Files:**
- Create: `src/ai/providers/sumopod.provider.ts`
- Create: `src/ai/completion/llm.interface.ts`
- Create: `src/ai/completion/llm.service.ts`
- Create: `tests/unit/ai/sumopod-provider.test.ts`
- Create: `tests/unit/ai/llm-service.test.ts`

**Interfaces:**
- Consumes: `AppEnv` AI fields and native `fetch`.
- Produces: `SumoPodProvider implements EmbeddingProvider, CompletionProvider`; `LlmService.completeJson<T>(request, schema): Promise<T>`.

- [ ] **Step 1: Write failing HTTP/provider tests**

Mock `fetch` and assert `/embeddings` receives model/input/dimensions, `/chat/completions` receives model/messages/JSON response mode, non-2xx responses become `AiProviderError`, and API keys never appear in thrown messages.

- [ ] **Step 2: Write failing LLM parser tests**

Cover valid JSON, fenced JSON extraction, malformed JSON, schema mismatch, timeout, and provider failure. Assert failures return a typed error instead of throwing an unstructured JSON parse exception.

- [ ] **Step 3: Implement provider and completion service**

Use `fetch` with an abort timeout, `Authorization: Bearer`, configured base URL, and OpenAI-compatible response shapes. Keep request/response mapping inside the provider. Let `LlmService` parse the assistant content, remove optional Markdown fences, validate with Zod, and return typed results.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/ai/sumopod-provider.test.ts tests/unit/ai/llm-service.test.ts` and `npm run typecheck`.

Expected: all provider/parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/providers src/ai/completion tests/unit/ai/sumopod-provider.test.ts tests/unit/ai/llm-service.test.ts
git commit -m "feat: add SumoPod AI provider abstraction"
```

### Task 4: Add vector columns, embedding metadata, and search RPC

**Files:**
- Create: `supabase/migrations/*_matching_ai_foundation.sql` (CLI-generated filename)
- Modify: `src/infrastructure/supabase/database.types.ts`
- Create: `tests/integration/database/matching-schema.test.ts`

**Interfaces:**
- Consumes: `profiles`, `jobs`, candidate ownership policies, and `EmbeddingResult` dimensions.
- Produces: `profiles.embedding`, `jobs.embedding`, metadata/status columns, HNSW cosine indexes, and authenticated `match_candidate_jobs(...)` RPC.

- [ ] **Step 1: Write static migration contract tests**

Assert the migration enables `vector` in `extensions`, uses `vector(1536)`, adds embedding status checks, creates HNSW cosine indexes, enables RLS, bounds search limit to 200, and filters by candidate ownership and ready status.

- [ ] **Step 2: Generate the migration filename**

Run: `npx supabase migration new matching_ai_foundation` and use the generated migration path.

- [ ] **Step 3: Implement schema and RPC**

Add nullable vectors and metadata to `profiles` and `jobs`. Add indexes only after columns exist. Define `match_candidate_jobs(p_candidate_id uuid, p_query_embedding extensions.vector(1536), p_match_threshold float, p_match_count int)` as `SECURITY INVOKER`, clamp count to 200, require `auth.uid() = p_candidate_id`, and return job ID plus cosine similarity for active, ready, candidate-owned jobs.

- [ ] **Step 4: Apply and verify the authorized remote migration**

Review the SQL, run Supabase security/performance advisors, apply through Supabase MCP, regenerate TypeScript types, and verify extension, columns, indexes, RLS, RPC security mode, and zero-row state with read-only SQL.

- [ ] **Step 5: Run static tests and commit**

Run: `npm test -- tests/integration/database/matching-schema.test.ts` and `npm run typecheck`.

```bash
git add supabase/migrations src/infrastructure/supabase/database.types.ts tests/integration/database/matching-schema.test.ts
git commit -m "feat: add vector matching schema"
```

### Task 5: Build profile/job embedding text and persistence services

**Files:**
- Create: `src/ai/embedding/profile-embedding-text.ts`
- Create: `src/ai/embedding/job-embedding-text.ts`
- Create: `src/services/profile-embedding-service.ts`
- Create: `src/services/job-embedding-service.ts`
- Create: `tests/unit/ai/embedding-text.test.ts`
- Create: `tests/unit/services/embedding-persistence.test.ts`

**Interfaces:**
- Consumes: Parsed profile fields, normalized jobs, `EmbeddingService`, and injected persistence repositories.
- Produces: `buildProfileEmbeddingText(profile)`, `buildJobEmbeddingText(job, skills)`, and services that set `pending`, `ready`, or `failed` metadata.

- [ ] **Step 1: Write failing text-builder tests**

Assert profile text contains role/experience/skills/preferences without Markdown headings, job text contains title/company/description/skills, empty sections are omitted, and normalized whitespace is stable.

- [ ] **Step 2: Write failing persistence tests**

Use fake embedding services and repositories to cover success, wrong-dimension failure, provider failure preserving source data, content checksum update clearing the vector, and retry status transitions.

- [ ] **Step 3: Implement text builders and services**

Build deterministic plain text, hash the generated text, call `EmbeddingService`, and persist vector metadata through typed repository interfaces. Never delete or overwrite raw job data on failure.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/ai/embedding-text.test.ts tests/unit/services/embedding-persistence.test.ts` and `npm run typecheck`.

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/embedding src/services/profile-embedding-service.ts src/services/job-embedding-service.ts tests/unit/ai/embedding-text.test.ts tests/unit/services/embedding-persistence.test.ts
git commit -m "feat: add profile and job embedding services"
```

### Task 6: Implement vector-search repository and service

**Files:**
- Create: `src/matching/types.ts`
- Create: `src/matching/matching.repository.ts`
- Create: `src/matching/vector-search.service.ts`
- Create: `tests/unit/matching/vector-search.test.ts`

**Interfaces:**
- Consumes: `match_candidate_jobs` RPC and `EmbeddingService`.
- Produces: `VectorSearchService.search(candidateId, limit, threshold): Promise<VectorMatch[]>`.

```ts
type VectorMatch = { jobId: string; similarity: number };
```

- [ ] **Step 1: Write failing repository/service tests**

Assert query embedding generation uses the candidate profile text, limits are clamped to 200, thresholds are validated, RPC errors become typed matching errors, and results preserve descending similarity.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/unit/matching/vector-search.test.ts`

Expected: FAIL because matching modules do not exist.

- [ ] **Step 3: Implement repository and service**

Keep Supabase RPC calls in the repository. The service obtains the active candidate profile embedding, rejects missing/not-ready embeddings, clamps input, and maps RPC rows into `VectorMatch`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/matching/vector-search.test.ts` and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/matching tests/unit/matching/vector-search.test.ts
git commit -m "feat: add vector search service"
```

### Task 7: Implement deterministic rule scoring and structured LLM evaluation

**Files:**
- Create: `src/matching/scoring/types.ts`
- Create: `src/matching/scoring/rules.ts`
- Create: `src/matching/scoring/scorer.ts`
- Create: `src/matching/llm-evaluator.ts`
- Create: `docs/prompts/job-matching.md`
- Create: `docs/prompts/recommendation.md`
- Create: `tests/unit/matching/scorer.test.ts`
- Create: `tests/unit/matching/llm-parser.test.ts`

**Interfaces:**
- Consumes: Candidate/job normalized data, `VectorMatch`, `LlmService`, and configurable scoring weights.
- Produces: `RuleScore` with breakdown/matched/missing skills and `AiMatchAnalysis` with `high_match|medium_match|low_match` recommendation.

- [ ] **Step 1: Write failing scorer tests**

Cover default 40/20/15/15/10 weights, skill overlap, role match, experience mismatch, location preference, missing skills, total clamping to 100, and custom rule weights.

- [ ] **Step 2: Write failing structured evaluation tests**

Assert prompt construction includes profile/job/rule score context, valid response mapping, invalid JSON typed failure, and failed AI evaluation does not erase the rule score.

- [ ] **Step 3: Implement pure scorer and evaluator**

Keep scoring provider-free and deterministic. Keep prompt templates in documentation files. Send only the bounded shortlist to `LlmService.completeJson`, validate the response schema, and return a typed failure object for invalid output or provider errors.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/matching/scorer.test.ts tests/unit/matching/llm-parser.test.ts` and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/matching/scoring src/matching/llm-evaluator.ts docs/prompts tests/unit/matching/scorer.test.ts tests/unit/matching/llm-parser.test.ts
git commit -m "feat: add rule scoring and LLM evaluation"
```

### Task 8: Add matching orchestration and authenticated API

**Files:**
- Create: `src/services/matching-service.ts`
- Modify: `src/app.ts`
- Modify: `src/server.ts`
- Create: `tests/integration/api/matching.test.ts`

**Interfaces:**
- Consumes: `VectorSearchService`, scorer, LLM evaluator, request-scoped Supabase client, and existing authenticator.
- Produces: `GET /matching/jobs/:candidateId` returning ranked recommendations with similarity, rule score/breakdown, AI analysis/failure, and final recommendation status.

- [ ] **Step 1: Write failing API tests**

Cover missing bearer token, candidate ID mismatch, invalid limit/threshold, successful ranked response, and partial AI failure with deterministic score preserved.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/integration/api/matching.test.ts`

Expected: FAIL because the route and orchestration service do not exist.

- [ ] **Step 3: Implement MatchingService**

Run vector search, fetch the candidate-owned job/profile data required for scoring, score all vector results deterministically, take a bounded shortlist, evaluate it with the LLM evaluator, and return stable API DTOs. Keep provider and repository errors typed.

- [ ] **Step 4: Add controller route and error mapping**

Add authentication, candidate ownership validation, query parameter parsing, and response formatting to `src/app.ts`. Construct request-scoped dependencies in `src/server.ts`. Controllers must not call SQL, embeddings, or providers directly.

- [ ] **Step 5: Run API tests, full suite, typecheck, and build**

Run: `npm test -- tests/integration/api/matching.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/services/matching-service.ts src/app.ts src/server.ts tests/integration/api/matching.test.ts
git commit -m "feat: expose authenticated matching API"
```

### Task 9: Add fixtures, ADRs, and final verification

**Files:**
- Create: `tests/fixtures/candidate-profile.md`
- Create: `tests/fixtures/job.json`
- Create: `tests/fixtures/embedding-response.json`
- Create: `tests/fixtures/llm-analysis-response.json`
- Create: `docs/decisions/001-markdown-profile-source-of-truth.md`
- Create: `docs/decisions/002-vector-search-for-job-matching.md`
- Create: `docs/decisions/003-sumopod-ai-provider.md`
- Modify: `README.md`

- [ ] **Step 1: Add fixtures and English ADRs**

Each ADR must include Problem, Decision, Reasoning, and Alternatives Considered. Fixtures must contain no real personal data or API credentials.

- [ ] **Step 2: Update README operational guidance**

Document AI environment variables, embedding dimension lock, migration process, matching endpoint, provider failure behavior, and the fact that real scrapers are out of scope.

- [ ] **Step 3: Run final verification**

Run `npm test`, `npm run typecheck`, and `npm run build`. Re-run Supabase security/performance advisors and read-only SQL verification for vector extension, dimensions, indexes, RLS, RPC bounds, and zero-data fixtures.

- [ ] **Step 4: Record completion evidence and commit**

Update the SDD ledger with migration names, test counts, advisor findings, and deferred two-user RLS testing, then commit:

```bash
git add tests/fixtures docs/decisions README.md .superpowers/sdd
git commit -m "docs: document matching engine and AI foundation"
```
