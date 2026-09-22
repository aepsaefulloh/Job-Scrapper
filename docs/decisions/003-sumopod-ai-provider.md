# ADR 003: SumoPod as the Initial AI Provider

## Problem

The application needs embeddings and structured completion while retaining the ability to change providers.

## Decision

Use SumoPod through an OpenAI-compatible HTTP adapter behind provider-independent interfaces. The default embedding contract is `text-embedding-3-small` with 1536 dimensions.

## Reasoning

The adapter isolates credentials, URLs, request formats, and response mapping from business logic. The fixed embedding contract keeps the vector schema consistent.

## Alternatives Considered

- Direct SDK calls in services: rejected because it couples the application to one provider.
- Local embeddings: deferred until operational requirements justify local model hosting.
