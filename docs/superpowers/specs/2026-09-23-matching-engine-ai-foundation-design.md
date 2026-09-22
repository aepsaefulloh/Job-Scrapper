# Matching Engine and AI Foundation Design

## Status

Proposed

## Context

The project now has a Markdown-based candidate profile system and a private, normalized job-ingestion foundation. It needs an intelligence layer that can rank existing jobs without requiring live scraping.

The current database uses `public.profiles` for parsed candidate profiles and `public.jobs` for normalized jobs. The intelligence layer must preserve those boundaries, keep AI provider details replaceable, and prevent expensive LLM calls from becoming the first-stage search mechanism.

## Goals

- Generate comparable candidate-profile and job embeddings.
- Search candidate-owned jobs with pgvector cosine similarity.
- Apply deterministic scoring before any LLM evaluation.
- Evaluate only a bounded shortlist with structured LLM output.
- Expose ranked recommendations through an authenticated API.
- Keep AI providers replaceable and testable with fakes.
- Make failures retryable and prevent an embedding failure from deleting source data.

## Non-goals

- Implementing LinkedIn, Jobstreet, or Glints scrapers.
- Building a frontend.
- Automating job applications.
- Calling an LLM for parsing, normalization, deduplication, or deterministic scoring.
- Supporting multiple embedding models in the same vector index at runtime.

## Fixed embedding contract

The default embedding contract is:

- Provider: SumoPod through its OpenAI-compatible API.
- Model: `text-embedding-3-small`.
- Dimensions: `1536`.
- Distance: cosine distance (`<=>`).

The model and dimensions are environment-configurable for provider replacement, but the configured dimensions must equal the database vector column dimension. Changing dimensions requires a deliberate migration and re-embedding of all records; the application must reject a provider response with the wrong length.

## Architecture

```text
Profile / normalized job text
          |
          v
   EmbeddingService
          |
          v
   EmbeddingProvider (SumoPod adapter)
          |
          v
   profiles.embedding / jobs.embedding
          |
          v
   VectorSearchService
          |
          v
   RuleScorer
          |
          v
   bounded shortlist
          |
          v
   LLMService -> structured analysis -> recommendation
```

### AI abstraction

`src/ai/` contains provider-independent interfaces and services:

- `embedding/embedding.interface.ts` defines `EmbeddingProvider.embed(text, options)` and the result contract.
- `embedding/embedding.service.ts` validates input, model, dimensions, and provider responses.
- `completion/llm.interface.ts` defines structured completion requests and responses.
- `completion/llm.service.ts` owns JSON parsing, schema validation, and provider error translation.
- `providers/sumopod.provider.ts` implements the OpenAI-compatible HTTP protocol without leaking provider details into domain code.

Business services depend on interfaces, never on an OpenAI SDK or SumoPod-specific module.

### Environment configuration

```text
AI_PROVIDER=sumopod
AI_API_KEY=<secret>
AI_BASE_URL=<OpenAI-compatible base URL>
AI_CHAT_MODEL=<chat model>
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536
```

The environment loader validates positive dimensions, required provider settings, and a supported provider name. Secrets are never logged or persisted.

## Embedding text and persistence

### Candidate profile text

The profile embedding input is generated from parsed structured fields, not raw Markdown:

```text
Role: <headline>
Summary: <summary>
Experience: <experience>
Skills: <canonical skill list>
Career preferences: <preferences>
```

Empty sections are omitted and whitespace is normalized. The active `public.profiles` row receives the vector and embedding metadata.

### Job text

The job embedding input contains title, company, description, location, employment type, workplace type, and deterministic job skills. It is generated from the normalized `public.jobs` row. The current job row receives the vector and embedding metadata.

Both entities store:

- nullable `embedding vector(1536)`;
- `embedding_model text`;
- `embedding_dimensions integer`;
- `embedding_content_checksum char(64)`;
- `embedding_status text` with `pending`, `ready`, and `failed`;
- `embedding_error text` for safe, non-secret failure diagnostics;
- `embedding_updated_at timestamptz`.

Content checksum changes clear the previous vector and set status to `pending`. Provider failure sets status to `failed` while retaining the profile/job row and raw source data for retry.

## Vector search

Enable `vector` in the `extensions` schema. Add HNSW cosine indexes only after the vector column exists. The SQL RPC `match_candidate_jobs` accepts `candidate_id`, a `vector(1536)` query embedding, a similarity threshold, and a bounded limit (maximum 200).

The RPC joins only candidate-owned active jobs with ready embeddings, applies the ownership predicate inside SQL, computes `1 - (embedding <=> query_embedding)`, orders by distance, and returns job ID plus similarity. Filtering inside the RPC keeps the vector planner effective and avoids post-filtering after ranking.

## Rule-based scoring

`src/matching/scoring/` contains pure deterministic code. The default score is 100 points:

- skills: 40;
- experience: 20;
- role: 15;
- location/workplace preference: 15;
- career preference: 10.

Rules are represented as typed configuration, not hard-coded branches in controllers. The scorer returns the total, a breakdown, matched skills, missing skills, and deterministic reasons. It never calls an LLM.

## LLM evaluation

Only the top bounded shortlist after vector search and rule scoring is sent to the LLM. Prompt templates live in:

- `docs/prompts/job-matching.md`;
- `docs/prompts/recommendation.md`.

The expected response is validated against a schema:

```json
{
  "match_score": 90,
  "strengths": ["Strong TypeScript experience"],
  "missing_skills": ["AWS"],
  "recommendation": "high_match"
}
```

Invalid JSON, schema mismatches, provider timeouts, and rate limits become typed evaluation failures. A single invalid evaluation does not crash the request or discard deterministic scores; the API returns the failure state for that recommendation.

## Matching API

`GET /matching/jobs/:candidateId` requires a valid bearer token. The controller verifies that the route candidate ID equals the authenticated user ID, validates optional `limit` and threshold parameters, and delegates to `MatchingService`.

The response is an array containing:

- `job_id`;
- `similarity`;
- `rule_score` and `breakdown`;
- `ai_analysis` or a typed AI failure state;
- final recommendation status.

Controllers do not create embeddings, execute SQL, call providers, or score jobs.

## Failure and retry behavior

- Missing or empty embedding text is rejected before a provider call.
- Provider responses with the wrong dimensions are rejected.
- Profile/job rows remain available when embedding generation fails.
- Embedding status and safe error metadata support explicit retry services.
- Vector search excludes non-ready embeddings.
- AI evaluation failure preserves vector and rule results.
- API errors use stable application error codes and do not expose provider keys, prompts, or raw provider responses.

## Testing strategy

- Unit tests for embedding text builders, dimension validation, provider request/response mapping, and error translation.
- Unit tests for rule weights, score breakdowns, missing skills, and configurable rules.
- Repository tests with fake Supabase clients for vector RPC parameters and ownership filters.
- LLM parser tests for valid JSON, malformed JSON, schema mismatch, and provider failure.
- API tests for authentication, candidate ownership, validation, ranked response formatting, and partial AI failure.
- Static migration tests for vector extension, dimensions, HNSW indexes, RLS, RPC bounds, and embedding status constraints.
- Fixtures for candidate profile, normalized job, embedding response, and LLM analysis response.

Runtime cross-user RLS tests remain dependent on two authenticated test users.

## Alternatives considered

### Provider SDK in business services

Rejected because it couples matching and embedding workflows to SumoPod/OpenAI-compatible details and makes provider replacement difficult.

### LLM-first ranking

Rejected because it is expensive, slower, less consistent, and unnecessary for deterministic filtering and first-pass ranking.

### Unbounded vector search or LLM shortlist

Rejected because a user-controlled limit could create excessive database or provider cost. Both RPC and LLM shortlist sizes are bounded.

### Asynchronous queue immediately

Deferred for this milestone. The service and status model support retry, while synchronous provider calls keep the fixture-backed foundation simple. A queue can be added later without changing provider interfaces.

## Completion criteria

- Candidate and normalized jobs can produce validated 1536-dimensional embeddings.
- Vector similarity search returns candidate-owned ranked jobs.
- Rule scoring produces configurable deterministic breakdowns.
- SumoPod completion evaluation returns validated structured JSON or a typed failure.
- Matching API returns ranked recommendations without controller-level provider or SQL logic.
- Tests, typecheck, build, migrations, and English documentation pass.
