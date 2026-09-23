# Job ingestion and embedding recovery

Scraped data continues through the existing deterministic ingestion path. The scheduler does not duplicate URL normalization, checksums, ownership, deduplication, `jobs_raw -> jobs -> job_skills`, or embedding behavior.

Embedding failure after persistence does not roll back a job. Recovery queries candidate-owned, non-deleted jobs whose vector is missing or whose embedding status is not `ready`, then invokes the same canonical embedding runner used by normal ingestion.

Enable bounded recovery with:

```env
JOB_EMBEDDING_RECOVERY_ENABLED=true
JOB_EMBEDDING_RECOVERY_LIMIT=25
JOB_SCRAPE_CANDIDATE_ID=<candidate UUID>
JOB_SCRAPE_ACCESS_TOKEN=<candidate access token>
```

The limit is required to remain between 1 and 100 and defaults to 25. A provider failure is recorded with the safe `EMBEDDING_FAILED` code, processing continues with the next job, and the service returns `{ found, completed, failed }`. Provider response bodies and exception messages are never logged.

Recovery can be enabled without live scraping. When both are enabled, they execute as separate boundaries during a scheduler tick; recovery failure cannot change the persisted scrape result.
