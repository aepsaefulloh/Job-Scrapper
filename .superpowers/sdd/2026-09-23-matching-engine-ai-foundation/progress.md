# SDD ledger - plan: docs/superpowers/plans/2026-09-23-matching-engine-ai-foundation.md
Pre-flight: Task 1 produces AI configuration and errors consumed by Tasks 2-3; Task 2 produces EmbeddingProvider/EmbeddingService consumed by Tasks 3, 5, and 6; Task 3 produces CompletionProvider/LlmService consumed by Tasks 7-8; Task 4 produces vector schema/RPC consumed by Tasks 5-6; Task 5 produces embedding persistence consumed by Task 6; Task 6 produces VectorMatch consumed by Tasks 7-8; Task 7 produces RuleScore/AiMatchAnalysis consumed by Task 8. Interfaces are consistent with the spec.
Task 1: complete (tests: npm test -- tests/unit/config/ai-env.test.ts -> 3/3 pass; typecheck pass)
Task 2: complete (tests: npm test -- tests/unit/ai/embedding-service.test.ts -> 3/3 pass; typecheck pass)
Task 3: complete (tests: npm test -- tests/unit/ai/sumopod-provider.test.ts tests/unit/ai/llm-service.test.ts -> 4/4 pass; typecheck pass)
Task 4: Ruling: pgvector operators are schema-qualified as extensions.<=> and extensions.vector_cosine_ops because the matching RPC uses an empty search_path; the first remote apply failed and rolled back, then the corrected migration applied successfully.
Task 4: complete (migration 20260922174312_matching_ai_foundation applied; tests: npm test -- tests/integration/database/matching-schema.test.ts -> 2/2 pass; typecheck pass; remote verification confirmed vector extension, 2 HNSW indexes, 2 embedding columns, invoker RPC)
Task 5: complete (tests: npm test -- tests/unit/ai/embedding-text.test.ts tests/unit/services/embedding-persistence.test.ts -> 4/4 pass; typecheck pass)
Task 6: complete (tests: npm test -- tests/unit/matching/vector-search.test.ts -> 2/2 pass; typecheck pass)
Task 7: complete (tests: npm test -- tests/unit/matching/scorer.test.ts tests/unit/matching/llm-parser.test.ts -> 4/4 pass; typecheck pass)
Task 8: Ruling: matching route dependencies remain injectable in createApp; production composition is deferred until a job-context repository is added, preventing a fake/no-op production recommendation path.
Task 8: complete (tests: npm test -- tests/integration/api/matching.test.ts -> 3/3 pass; typecheck and build pass)
