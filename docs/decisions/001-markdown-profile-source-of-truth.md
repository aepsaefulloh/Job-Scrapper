# ADR 001: Markdown Profile as Source of Truth

## Problem

Candidate information must remain understandable and editable by the candidate without depending on an LLM.

## Decision

Use a human-maintained Markdown profile as the canonical source. Parse it deterministically into structured profile records; use LLMs only for downstream reasoning.

## Reasoning

Markdown is portable, auditable, versionable, and easy to review. Deterministic parsing prevents silent profile drift.

## Alternatives Considered

- LLM-only extraction: rejected because it is nondeterministic.
- Proprietary form-only profile: rejected because it is less portable and harder to audit.
