# SDD ledger - plan: docs/superpowers/plans/2026-09-22-job-data-model.md
Pre-flight: Task 2 consumes domain fields from Task 1; Task 3 consumes JobIngestionRecord from Task 1 and generated RPC types; Task 4 consumes Task 1 contracts and Task 3 repository; Task 5 consumes RawJobInput and Task 4 service. Interfaces are consistent.
Task 1: complete (commits pending, tests: npm test -- tests/unit/domain/job-normalizer.test.ts tests/unit/domain/job-skills.test.ts -> 4/4 pass; typecheck pass)
Task 2: Ruling: the initial migration required a follow-up generated migration for jobs.source_payload_id because the performance advisor reported an unindexed foreign key; applied index migration 20260922162957 and retained empty-table unused-index INFO notices.
Task 2: complete (migration 20260922162703_job_data_model plus 20260922162957_add_jobs_source_payload_index applied remotely; tests: npm test -- tests/integration/database/job-schema.test.ts -> 2/2 pass; remote tables/RLS/RPC/types/advisors verified)
Task 3: complete (tests: npm test -- tests/unit/infrastructure/job-repository.test.ts -> 2/2 pass; typecheck pass)
Task 4: Ruling: JobIngestionService accepts candidateId and an optional accessToken because the repository is already constructed with the request-scoped authenticated Supabase client; this preserves RLS without duplicating client construction.
Task 4: complete (tests: npm test -- tests/unit/services/job-ingestion-service.test.ts -> 2/2 pass; typecheck pass)
