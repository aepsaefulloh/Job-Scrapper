# Job Data Model and Ingestion Design

## Status

Proposed

## Context

The application needs a durable job-data foundation before scraper modules and matching logic are added. Job sources expose different identifiers, fields, formats, and update behavior. Raw source data must remain available for audit and reprocessing, while downstream features need a stable normalized representation.

The candidate profile system already uses Supabase PostgreSQL with authenticated, candidate-owned rows. The job subsystem must preserve that security boundary and must not couple scraping, normalization, matching, or HTTP concerns.

## Goals

- Preserve the original source payload for audit and reprocessing.
- Normalize heterogeneous source records into a stable job contract.
- Make ingestion idempotent for repeated scraper runs.
- Keep source adapters independent from persistence and matching.
- Provide deterministic skill hints without requiring an LLM.
- Enforce ownership and access through PostgreSQL RLS.
- Establish contracts that later scraper modules can implement.

## Non-goals

- Implementing LinkedIn, Jobstreet, Glints, or any other scraper.
- Calling an LLM during ingestion or normalization.
- Building vector embeddings or final candidate-job matching.
- Building a public job marketplace or cross-user job sharing.
- Adding a frontend workflow.

## Recommended architecture

```text
Source adapter
    |
    v
RawJobInput contract
    |
    v
JobNormalizer (deterministic)
    |
    +--> jobs_raw (immutable source payload)
    |
    +--> jobs (normalized current representation)
              |
              +--> job_skills (normalized skill hints)
```

The source adapter owns external extraction only. `JobIngestionService` owns validation, checksum calculation, normalization, and the persistence transaction. The repository owns Supabase access. No controller or scraper calls Supabase directly.

## Data model

### `jobs_raw`

Stores each accepted source observation.

- `id uuid primary key`
- `source text not null`
- `external_id text` when the source provides one
- `canonical_url text not null`
- `payload jsonb not null`
- `payload_checksum char(64) not null`
- `fetched_at timestamptz not null`
- `created_at timestamptz not null`
- `deleted_at timestamptz` for retention workflows

An index on `(source, external_id)` is used when `external_id` is present. A unique constraint on `(source, canonical_url, payload_checksum)` prevents duplicate observations from the same fetch while allowing later revisions.

### `jobs`

Stores the latest normalized representation for a logical job.

- `id uuid primary key`
- `source text not null`
- `external_id text`
- `canonical_url text not null`
- `title text not null`
- `company_name text not null`
- `description text not null`
- `location text`
- `employment_type text`
- `workplace_type text`
- `published_at timestamptz`
- `expires_at timestamptz`
- `source_payload_id uuid not null references jobs_raw(id)`
- `content_checksum char(64) not null`
- `status text not null default 'active'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

The logical identity is `(source, external_id)` when an external ID exists. If it does not, `(source, canonical_url)` is used. The repository performs an upsert through a database function so identity resolution and child replacement are atomic.

### `job_skills`

Stores deterministic skill hints associated with the current normalized job.

- `id uuid primary key`
- `job_id uuid not null references jobs(id) on delete cascade`
- `display_name text not null`
- `canonical_name text not null`
- `match_method text not null default 'keyword'`
- `created_at timestamptz not null`
- unique `(job_id, canonical_name)`

The first normalizer uses an explicit configured vocabulary and conservative token matching. It does not infer skills with an LLM. Later matching stages may combine these hints with embeddings and LLM evaluation.

## Ingestion behavior

1. A source adapter creates a `RawJobInput` with source, URL, optional external ID, fetch timestamp, and JSON payload.
2. The service validates required fields and canonicalizes the URL.
3. The normalizer produces a `NormalizedJob` and deterministic skill hints.
4. The service calculates SHA-256 checksums for the raw payload and normalized content.
5. A repository RPC inserts the raw observation and upserts the normalized job in one transaction.
6. If the normalized job changes, the old `source_payload_id` is replaced and the current skill rows are replaced atomically.
7. Reprocessing an identical payload is idempotent and does not create a second current job.

Malformed input is rejected before persistence. Database errors are returned as service errors; callers must not receive raw Supabase error details.

## Security and access model

All three job tables are in the exposed `public` schema, so RLS is enabled on every table and access is granted only to `authenticated`.

The initial ownership model associates jobs with the candidate that ingested them through `candidate_id`. Policies require `auth.uid() = candidate_id`; child rows authorize through their parent job. This keeps each user's imported job set private while leaving room for a future shared-catalog model with an explicit redesign.

The ingestion RPC is `SECURITY INVOKER`, validates the authenticated candidate, and is executable only by `authenticated`. No service-role key is used by the API.

## Testing strategy

- Unit tests for URL canonicalization, required-field validation, checksum stability, skill extraction, and idempotent normalization.
- Repository contract tests with fakes for insert/upsert behavior and error translation.
- Static migration tests for RLS, ownership predicates, uniqueness, foreign keys, and indexes.
- Remote verification after migration: table shape, enabled RLS, policy count, function security mode, and empty initial row counts.

Cross-user runtime RLS tests require two authenticated Supabase users and are deferred until test credentials are available.

## Alternatives considered

### One table only

Rejected because it loses source fidelity and makes reprocessing or debugging normalization changes difficult.

### Raw storage without a normalized table

Rejected because downstream matching would repeatedly parse source-specific payloads and could not rely on a stable contract.

### LLM-first extraction

Rejected for ingestion because parsing, normalization, and deduplication are deterministic concerns. LLM evaluation belongs later in the matching pipeline.

### Shared global job catalog

Deferred. It would require a separate ownership and moderation model, while the first milestone is a private personal recruiter.

## Open decisions resolved by this design

- Raw and normalized records are both persisted.
- The first release uses private candidate-owned jobs.
- Source adapters are contracts only; scraper implementation is a later subsystem.
- Deterministic skill hints precede embeddings and LLM reasoning.
