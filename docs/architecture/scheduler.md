# Scheduler

The scheduler is an in-process adapter around the existing scraping orchestrator. It requires a persistent Node.js process; it is not intended for request-scoped serverless runtimes. A Railway, Render, Fly.io, or VPS deployment can run it without additional queue infrastructure.

## Configuration

Scheduling is disabled by default. Enable it explicitly:

```env
JOB_SCRAPE_ENABLED=true
JOB_SCRAPE_CRON=0 7 * * *
JOB_SCRAPE_TIMEZONE=Asia/Jakarta
JOB_SCRAPE_CANDIDATE_ID=<candidate UUID>
JOB_SCRAPE_ACCESS_TOKEN=<candidate access token>
JOB_SCRAPE_SEARCHES_JSON=[{"source":"jobstreet","keyword":"backend engineer","location":"Indonesia","maxPages":3}]
```

The search JSON accepts at most 20 entries. Each entry currently supports `jobstreet`, a required keyword, an optional location, and `maxPages` from 1 through 20. Invalid JSON, cron expressions, timezones, or enabled configurations missing credentials fail during startup with a configuration error. The candidate access token is user-scoped and must be provisioned and rotated operationally; service-role credentials are not used.

Development and tests do not scrape automatically because `JOB_SCRAPE_ENABLED` defaults to `false`. The standard test suite uses scheduler, browser, repository, and provider doubles.

## Lifecycle and failures

The composition root starts one cron task and stops it on `SIGINT` or `SIGTERM`. Each tick keeps scraping and embedding recovery as separate service calls. A scrape failure is recorded by `ScrapeRunService` and does not prevent the recovery batch from running.

Structured events are `scheduler.started`, `scheduler.disabled`, `scheduler.tick`, `scheduler.search.started`, `scheduler.search.skipped`, `scheduler.search.completed`, and `scheduler.search.failed`. Logs contain only bounded search metadata and safe error codes.

## Concurrency

Search identity is a SHA-256 digest of normalized source, keyword, and location. Case, outer whitespace, and repeated internal whitespace do not create a new identity. `maxPages` is deliberately excluded because it changes work size, not the logical search.

Before execution, the scheduled task reserves the candidate/search identity in memory and checks `scrape_runs` for a matching `pending` or `running` row. An active same-candidate, same-source, same-keyword, same-location run produces `scheduler.search.skipped` with `reason: ACTIVE_RUN`. Different searches continue independently. The in-memory reservation closes the asynchronous check race inside the monolith; `scrape_runs` protects against an already-active persisted run. This is intentionally not a distributed lock.

Manual triggers use the same orchestrator and ingestion flow but do not use the scheduled concurrency guard.
