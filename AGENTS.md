# AGENTS.md

## Project Overview

Job Scrapper is a personal AI-powered job search assistant. It maintains one candidate's career profile, ingests job opportunities, evaluates compatibility, generates application materials, and supports application workflows.

The candidate profile is the primary source of truth. Human-maintained Markdown has priority over any LLM extraction.

## Current Repository Status

Implemented:

- Markdown candidate profile parser (with support for bilingual ID/EN natural converted CV formats) and authenticated profile upload API.
- Supabase PostgreSQL schema for candidates, profiles, profile documents, skills, and scrape runs.
- Private Supabase Storage bucket for profile documents.
- Job ingestion foundation: `jobs_raw`, `jobs`, `job_skills`, and `scrape_runs`.
- Deterministic job URL normalization, checksums, deduplication, and skill hints.
- Authenticated repository, ingestion service, source-adapter contract, RLS, and applied remote migrations.
- SumoPod AI provider adapter, pgvector embeddings, rule-based matching, and recommendation API.
- Jobstreet scraper implementation with Camoufox browser session and scheduled ingestion.
- Application tracking and application assistant workflows (backend services, repository, and AI material generation: cover letter, introduction, recruiter answer).
- Monorepo restructure (`backend/` and `frontend/`) with unified `/api` prefix and Express production SPA serving (`/* -> frontend/dist`).
- Vue 3 + Vite + Tailwind CSS dashboard ("JobToolkit") with editorial design, Supabase Auth, jobs discovery, application tracking (list/table view), AI material generator, profile viewer, and responsive navigation.
- Candidate search profile model derived from candidate profile (persisted and reused, no LLM on every run).
- Role alias registry and deterministic query expansion (career-domain agnostic).
- Search planner that generates `JobSearchIntent[]` for any professional background.
- Hard-filter eligibility layer (does not reject on skill mismatch).
- Scheduler refactored to candidate-driven plans with hardcoded fallback.
- `GET /api/search-profile` API endpoint.
- Frontend `SearchProfileCard` (read-only transparency of agent search state).
- Unit tests, integration tests, strict TypeScript checking, and production build across both workspaces.


Not yet implemented:

- Frontend editor for search profile preferences (locations, exclusions, sources).
- Glints or Loker.id scraper implementations.
- Application Policy and Assisted Apply workflows.
- Runtime cross-user RLS tests with two authenticated test users.

## Architecture Rules

### Backend

- Use Node.js, TypeScript strict mode, Express, Supabase, and PostgreSQL.
- Keep layers separate: API, controllers, services, and infrastructure.
- Controllers handle validation, authentication, and response formatting only.
- Business logic belongs in services or domain modules.
- Use dependency injection where it improves testability.

### AI

- Never call an LLM directly from controllers, scrapers, or repositories.
- Route all LLM calls through `src/ai/` and provider adapters under `src/ai/providers/`.
- Keep provider-specific code replaceable; the current provider is SumoPod AI.
- Do not use an LLM for parsing, normalization, sorting, filtering, deduplication, or simple skill comparison.
- Prefer deterministic rules and vector similarity before LLM reasoning.

### Job ingestion

```text
Source adapter -> RawJobInput -> deterministic normalizer -> repository/RPC -> database
```

- Scrapers only collect external data.
- Normalizers only validate and transform data.
- Repositories only perform persistence.
- Matching logic must not be placed in scraper modules.
- Preserve raw source payloads for audit and reprocessing.
- Keep ingestion idempotent and candidate-owned.

### Matching pipeline

```text
Candidate profile -> embeddings -> vector search -> rule scoring -> LLM evaluation -> recommendation
```

Do not send an unfiltered large job set directly to an LLM.

## Supabase and Database Rules

- Use migrations for every schema change.
- Inspect existing tables before changing the schema.
- Enable RLS on every exposed table.
- Every policy must enforce ownership, not merely `TO authenticated`.
- Prefer `SECURITY INVOKER` functions. If `SECURITY DEFINER` is unavoidable, restrict execution explicitly and document why.
- Keep raw and processed data separate.
- Use typed queries and regenerate `src/infrastructure/supabase/database.types.ts` after schema changes.
- Run Supabase security and performance advisors after migrations.
- Remote migrations are external changes: review the SQL and obtain explicit approval before applying them.
- Local development does not require Docker; use the configured remote Supabase project when authorized.

## Security

Never commit:

- API keys, tokens, cookies, or browser sessions.
- Candidate CVs, private Markdown profiles, personal information, or application history.
- Service-role keys in application or client code.

Use environment variables and keep `.env` files untracked. Use the caller's access token for user-scoped Supabase operations.

## Testing

Every important business rule requires a test. Prioritize:

- Profile parser behavior.
- Job normalizer and URL canonicalization.
- Deduplication and checksum stability.
- Matching scores and recommendation rules.
- AI response parsing and provider failures.
- RLS ownership boundaries.

Run before claiming completion:

```powershell
bun test
bun run typecheck
bun run build
```

Use fixtures for candidate Markdown, raw jobs, normalized jobs, and mock AI responses. Tests must be written before production code for new behavior.

## Documentation

- Keep technical documentation and decision records in English.
- Record important decisions in `docs/decisions/`.
- Keep feature specs and plans under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Update `README.md` when setup, migrations, or operational workflows change.

## Development Priorities

Continue in this order unless the user explicitly changes scope:

1. Matching engine.
2. AI abstraction and SumoPod provider.
3. Real scraper adapters and scheduling.
4. Application assistant and application tracking.
5. Optional frontend/UI work.

The core engine should remain useful without a frontend.

## Git and Delivery

- Work on a feature branch or isolated worktree for non-trivial changes.
- Keep commits small and descriptive.
- Do not push or create a pull request without explicit user approval.
- Before merging, run the complete verification commands and confirm the target base branch.
