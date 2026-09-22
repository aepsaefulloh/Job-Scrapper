# SDD ledger - plan: docs/superpowers/plans/2026-09-22-job-data-model.md
Pre-flight: Task 2 consumes domain fields from Task 1; Task 3 consumes JobIngestionRecord from Task 1 and generated RPC types; Task 4 consumes Task 1 contracts and Task 3 repository; Task 5 consumes RawJobInput and Task 4 service. Interfaces are consistent.
Task 1: complete (commits pending, tests: npm test -- tests/unit/domain/job-normalizer.test.ts tests/unit/domain/job-skills.test.ts -> 4/4 pass; typecheck pass)
