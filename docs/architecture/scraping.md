# Scraping

Both manual and scheduled execution share this pipeline:

```text
trigger -> ScrapeRunService -> ScraperOrchestrator -> source adapter
        -> JobIngestionService -> existing persistence/RPC -> embedding attempt
```

The scheduler contributes timing and concurrency control only. It does not normalize, persist, deduplicate, or embed jobs. Jobstreet receives the configured keyword, location, and bounded `maxPages`; pages use one browser session and duplicate detail URLs are ignored within a search.

Every execution creates a `scrape_runs` row. Completion stores discovered, inserted, updated, duplicate, and failed counts. Fatal failures store only `SCRAPE_FAILED` and a safe message. Raw provider/browser errors and credentials are not persisted or logged.

The existing bounded navigation retry remains in the Jobstreet adapter. There is no unbounded retry, distributed queue, Redis, or BullMQ dependency.
