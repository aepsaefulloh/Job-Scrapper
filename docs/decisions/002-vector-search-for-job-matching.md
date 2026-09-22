# ADR 002: Vector Search for Job Matching

## Problem

Keyword matching alone misses semantically similar jobs and does not scale to a large private job collection.

## Decision

Use pgvector cosine search as the first-stage semantic retrieval layer, followed by deterministic scoring and bounded LLM evaluation.

## Reasoning

Vector search reduces the candidate set before expensive reasoning and keeps filtering inside PostgreSQL with candidate ownership predicates.

## Alternatives Considered

- LLM-first ranking: rejected due to cost and inconsistency.
- Keyword-only search: retained as deterministic scoring evidence, but insufficient as the only retrieval method.
