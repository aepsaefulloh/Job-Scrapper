# Personal Job Search Agent Architecture

The system is career-domain agnostic — it works for accounting, marketing, HR,
operations, tech, legal, education, hospitality, or any professional background.

## Flow

Candidate Markdown
    → Structured Candidate Profile (parser)
    → CandidateSearchProfile (SearchProfileService.deriveFromProfile)
    → JobSearchIntent[] (SearchPlanner.createIntents)
    → Scraper Adapters (Jobstreet; future: Glints, Loker.id)
    → Normalization + Deduplication
    → Eligibility Filter (applyHardFilters — hard rejects only)
    → Matching Engine (vector → rule scoring → LLM evaluation)
    → Recommendation

## Key Modules

- `src/search/search-types.ts` — shared types
- `src/search/role-alias-registry.ts` — deterministic alias expansion
- `src/search/query-expander.ts` — profile → keyword list
- `src/search/search-planner.ts` — keywords + locations → intents
- `src/search/eligibility-filter.ts` — hard reject before matching
- `src/search/search-profile.service.ts` — derive + persist + retrieve
- `src/search/search-profile.repository.ts` — Supabase persistence

## Design Decisions

- No LLM called inside the scheduler or scraper
- Search profile is persisted and reused, not regenerated every run
- Scraper adapters only discover; matching decides relevance
- Hard filters never reject on skill mismatch alone
- Alias registry is small and extensible, not a large taxonomy
- Hardcoded JOB_SCRAPE_SEARCHES_JSON is a fallback when no profile exists

## Future

- Frontend editor for search profile preferences
- Glints + Loker.id scraper adapters
- Application Policy for Assisted Apply
