# AI Token Usage Optimization Design

## Status

Approved for implementation planning.

## Context

Job discovery can ingest dozens of jobs per source while the current matching service evaluates every vector match with an LLM. The search execution UI also reports an AI stage even though candidate-driven discovery does not currently invoke the matching service. This makes cost controls incomplete and run telemetry inaccurate.

The optimized flow must keep deterministic work ahead of AI, evaluate only jobs encountered by the current search execution, reuse unchanged evaluations, and preserve on-demand application material generation.

## Goals

- Enforce this order: scrape, normalize, deduplicate, freshness filter, eligibility filter, embedding similarity, rule score, Top-N, LLM evaluation.
- Bound LLM evaluations per search execution with environment configuration.
- Use compact structured candidate and job contexts instead of CV Markdown, raw payloads, or full page content.
- Reuse AI evaluations when the candidate profile, job, prompt, and model are unchanged.
- Produce concise schema-validated AI output.
- Record safe per-execution AI usage metrics and expose them in Run Detail.
- Keep cover letters, introductions, and recruiter answers strictly on-demand.

## Non-goals

- Adding an asynchronous worker or queue.
- Applying migrations to the remote Supabase project without explicit approval.
- Replacing deterministic normalization, freshness, eligibility, vector similarity, or rule scoring with an LLM.
- Generating application materials during discovery.
- Sending raw scraper payloads, HTML, or source CV Markdown to the LLM.

## Selected Approach

Use an execution-scoped pipeline. Each scraper run returns the unique job IDs that passed freshness and eligibility. After all sources complete, matching operates only on that union of job IDs. A subset-aware pgvector RPC ranks those jobs, deterministic scoring applies the rule threshold, and only the highest-ranked configured Top-N reaches AI cache lookup and possible LLM evaluation.

Alternatives rejected:

- Ranking every active candidate job after each search would make per-run metrics misleading and repeatedly reconsider old jobs.
- Adding an asynchronous queue would introduce worker, retry, and operational complexity that is unnecessary for the bounded workload.

## Configuration

The environment loader owns all cost controls:

```env
AI_MATCH_MAX_JOBS_PER_RUN=20
AI_MATCH_MIN_VECTOR_SCORE=0.60
AI_MATCH_MIN_RULE_SCORE=60
```

Validation rules:

- `AI_MATCH_MAX_JOBS_PER_RUN`: integer from 1 through 100, default 20.
- `AI_MATCH_MIN_VECTOR_SCORE`: finite number from -1 through 1, default 0.60.
- `AI_MATCH_MIN_RULE_SCORE`: finite number from 0 through 100, default 60.

Controllers may request stricter limits but cannot exceed these server-side bounds. Services receive a typed matching policy through dependency injection; thresholds are not duplicated in controllers or deep service branches.

## Execution-Scoped Data Flow

```text
Scrape
  -> normalize and persist
  -> deduplicate
  -> freshness filter
  -> eligibility filter
  -> embed eligible jobs only when new or changed
  -> collect unique eligible job IDs
  -> pgvector rank within those IDs
  -> deterministic rule score and threshold
  -> sort by rule score, then vector similarity
  -> configured Top-N
  -> AI cache lookup
       -> hit: reuse evaluation
       -> miss: compact context -> LLM -> persist cache
  -> persist search execution metrics
```

Freshness and eligibility run for inserted, updated, and duplicate discoveries. Duplicate jobs can therefore participate in the current execution without triggering a new embedding. Ineligible jobs are persisted for audit but never embedded or evaluated during that execution.

The scraper orchestrator returns operational counts plus `eligibleJobIds` and `jobsSentToEmbedding`. These internal job IDs are not exposed as telemetry. The candidate search service deduplicates IDs across sources before invoking matching once for the parent execution.

## Eligibility

The existing deterministic `applyHardFilters` function remains the authority. It receives normalized job fields and the persisted candidate search profile. Missing skills never cause hard rejection; skills belong to scoring.

Manual and scheduled searches both resolve the candidate search profile and pass it into each scraper request. The same eligibility behavior therefore applies to both entry points.

## Vector Search and Rule Ranking

A new security-invoker RPC ranks only the supplied execution job IDs. It must:

- require the authenticated candidate to match `p_candidate_id`;
- filter by `candidate_id`, active status, non-deleted state, ready embedding, and supplied job IDs;
- apply `AI_MATCH_MIN_VECTOR_SCORE` before returning rows;
- order by cosine distance;
- cap the SQL result count independently of caller input.

The application loads compact job contexts for returned IDs, applies deterministic rule scoring, removes scores below `AI_MATCH_MIN_RULE_SCORE`, orders by rule score descending and vector similarity descending, then takes `AI_MATCH_MAX_JOBS_PER_RUN`.

Jobs below either threshold never reach cache lookup or the LLM.

## Compact Candidate Context

`candidate_search_profiles.profile_data` is the reusable matching context because it is already persisted and invalidated when the active candidate profile changes. The LLM projection contains only:

```text
targetRoles
skills (primary and secondary)
experienceYears
seniority
industries
preferredLocations
workModes
employmentTypes
```

Excluded roles, keywords, and companies remain deterministic eligibility inputs and are not sent to the LLM. Salary is omitted unless matching logic later requires it.

The active `profile_documents.checksum` is the candidate cache version. No source Markdown or long free-form CV fields are included in the evaluation prompt.

## Compact Job Context

The job projection contains only:

```text
title
company
requirements
responsibilities
skills
experienceRequirement
location
employmentType
workplaceType
```

Requirements, responsibilities, and experience requirement are derived deterministically from the normalized description using recognized section headings and bounded excerpts. Missing sections become empty values. The full description, raw source payload, and HTML are never sent to the LLM.

Every textual field has an explicit character limit and every list has an item limit so malformed or unusually long source content cannot expand prompt size without bound.

The existing `jobs.content_checksum` is the job cache version.

## AI Evaluation Cache

Create `public.ai_match_evaluations` with:

- `id uuid primary key`;
- `candidate_id uuid not null` referencing candidates with cascade delete;
- `job_id uuid not null` referencing jobs with cascade delete;
- `profile_checksum char(64) not null`;
- `job_checksum char(64) not null`;
- `prompt_version text not null`;
- `model text not null`;
- `evaluation jsonb not null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

The cache identity is a unique index on:

```text
candidate_id, profile_checksum, job_checksum, prompt_version, model
```

The table is exposed only to `authenticated`, has RLS enabled, and has candidate-owned select, insert, and update policies. Update policies include both `USING` and `WITH CHECK`. Repository reads and upserts always include `candidate_id`.

Changing the profile document, normalized job content, prompt version, or chat model produces a cache miss without deleting historical entries. Cascade deletion removes entries when the owning candidate or job is deleted.

## Prompt and Structured Output

The matching prompt has a code-owned version constant such as `job-match-v2`. It receives JSON containing the two compact contexts and deterministic scoring evidence.

The validated output is:

```json
{
  "score": 82,
  "recommendation": "strong_match",
  "strengths": ["..."],
  "gaps": ["..."],
  "summary": "..."
}
```

Constraints:

- score is an integer from 0 through 100;
- recommendation is `strong_match`, `potential_match`, or `weak_match`;
- strengths contains at most three short items;
- gaps contains at most three short items;
- summary has a fixed short maximum length;
- unknown fields are rejected;
- invalid provider output becomes a typed evaluation failure and is not cached.

The API may retain compatibility aliases during migration, but new domain code uses `score`, `gaps`, and the new recommendation enum consistently.

## Matching Result and Failure Behavior

Each shortlisted result preserves:

- job ID and vector similarity;
- deterministic rule score and breakdown;
- AI evaluation and whether it came from cache;
- final recommendation;
- a typed AI failure when evaluation fails.

A failure for one job does not discard deterministic results or stop other evaluations. The parent search execution is `partial` when at least one shortlisted AI evaluation fails. Cache hits are valid AI evaluations and count toward `aiEvaluated`, but not `jobsSentToLlm`.

## AI Usage Metrics

Extend `SearchExecutionSummary` with:

```text
jobsConsidered
jobsSentToEmbedding
jobsSentToLlm
aiCacheHits
aiCacheMisses
```

Definitions:

- `jobsConsidered`: unique execution jobs that passed freshness and eligibility and entered vector matching.
- `jobsSentToEmbedding`: eligible new or changed jobs for which an embedding provider call was attempted.
- `jobsSentToLlm`: cache misses for which an LLM provider call was attempted.
- `aiCacheHits`: shortlisted evaluations reused from cache.
- `aiCacheMisses`: shortlisted evaluations absent from cache, including calls that later fail.
- `aiEvaluated`: successful shortlisted evaluations from cache plus successful new LLM results.
- `aiFailed`: attempted new evaluations that failed.

Existing execution rows that lack these JSON fields map them to zero. Run Detail displays the five new counters in a compact AI Usage section and preserves current ingestion metrics.

Timeline and stage labels must reflect real execution. The AI matching stage starts only when matching begins, reports shortlist/cache/LLM counts on completion, and is not marked successful if the matching service never ran.

## Application Materials Boundary

Candidate discovery depends only on matching interfaces. It never constructs or invokes `ApplicationAssistantService`.

Cover letter, introduction, and recruiter-answer generation remain reachable only through their explicit application endpoints after an application exists. A discovery service test must fail if any application material generator is called.

## API Behavior

The existing matching endpoint uses the same centralized policy, compact contexts, and cache. User-supplied `limit` and vector threshold may only make evaluation stricter; they cannot increase the configured Top-N or lower the configured minimum vector score.

Search execution detail responses expose the extended summary metrics. They do not expose prompts, cached context, raw provider responses, token contents, credentials, or provider errors.

## Database Workflow

The project uses imperative migrations. Implementation creates and reviews a new migration for the cache table and subset vector RPC, updates generated database types, and adds static schema tests. The migration is not applied to the configured remote Supabase project until the user explicitly approves that external change.

After an approved remote application, run Supabase security and performance advisors and verify candidate-owned access with authenticated test users when available.

## Testing Strategy

TDD coverage must include:

- low vector-score jobs never load rule/LLM context;
- low rule-score jobs never reach cache or LLM;
- the configured Top-N is respected even when callers request more;
- a cache hit skips the LLM provider;
- profile checksum changes cause a cache miss;
- job checksum changes cause a cache miss;
- prompt-version and model changes cause a cache miss;
- LLM output rejects more than three strengths or gaps and overlong summaries;
- candidate and job prompt contexts omit Markdown, raw payloads, full descriptions, and unrelated fields;
- unchanged duplicate jobs can reuse embeddings and cached evaluations;
- discovery never generates application materials;
- search execution metrics distinguish embedding calls, LLM calls, cache hits, and misses;
- old search execution summaries default missing metrics to zero;
- cache RLS and ownership predicates are present;
- subset vector RPC enforces ownership, active status, embedding readiness, threshold, and bounds;
- Run Detail renders the new metrics and remains usable with legacy summary data.

## Documentation

- Update `.env.example` and README configuration documentation.
- Update the matching prompt documentation with prompt version and compact input/output contracts.
- Record the persistent evaluation cache decision in `docs/decisions/`.
- Update the project overview/status after implementation.

## Completion Criteria

- LLM evaluation occurs only after freshness, eligibility, vector, and rule filtering.
- Each search execution has a server-enforced LLM Top-N bound.
- Candidate and job prompts use compact structured contexts.
- Unchanged profile/job/prompt/model combinations reuse cached evaluations.
- AI output is concise and schema validated.
- Application materials remain on-demand only.
- Run Detail shows accurate AI usage metrics.
- Required unit, integration, schema, API, and frontend tests pass.
- Backend and frontend typecheck and production builds pass.
- No remote migration is applied without explicit approval.
