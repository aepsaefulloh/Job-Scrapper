# Candidate Profile System Design

## Purpose

Provide a private, API-driven way for a candidate to upload and maintain a Markdown career profile. The uploaded Markdown document is the canonical human-maintained source of truth. Deterministically parsed, structured data supports later job matching without using an LLM for profile extraction.

## Scope

This increment establishes the backend profile foundation only:

- authenticated Markdown upload;
- private, revisioned source-document storage;
- deterministic Markdown parsing;
- a structured active profile and normalized skills;
- row-level access control and tests.

Job ingestion, embeddings, LLM reasoning, and application workflows are out of scope.

## Architecture

```text
POST /v1/profile/document
        |
ProfileController
        |
ProfileService
  |                 |
  v                 v
ProfileDocumentStorage   MarkdownProfileParser
  |                       |
  v                       v
Supabase Storage     PostgreSQL profile records
```

The controller owns authentication, request validation, and HTTP response formatting. `ProfileService` owns revision creation and orchestration. The storage adapter owns private Supabase Storage interactions. `MarkdownProfileParser` is a pure, deterministic domain component.

No controller calls an LLM. No LLM participates in parsing, normalization, or validation.

## Data Model

`candidates`

- Owns candidate-scoped records and is identified by the authenticated Supabase user ID.

`profile_documents`

- Stores document metadata: candidate ID, private Storage object path, SHA-256 checksum, byte size, parser version, upload time, and soft-delete timestamp.
- Each upload creates a new immutable revision.

`profiles`

- Stores parsed fields for a source document: display name, headline, summary, experience text, career preferences text, and an `is_active` flag.
- Exactly one non-deleted active profile is allowed per candidate.

`profile_skills`

- Stores normalized skills belonging to a profile, with a display label, canonical key, optional category, and optional proficiency value.
- The service replaces skills only for the newly activated profile; historical revisions remain intact.

All tables in the exposed `public` schema have RLS enabled. Policies restrict every operation to `auth.uid() = candidate_id`. The `candidate-profile-documents` bucket is private and its Storage policies apply the same ownership restriction to object paths rooted at the authenticated user ID.

## Upload API

`POST /v1/profile/document`

- Requires authentication.
- Accepts one `.md` file in `multipart/form-data`.
- Rejects empty files, non-Markdown extensions, invalid UTF-8, and files over the configured size limit.
- Returns `201 Created` with document ID, active profile ID, SHA-256 checksum, upload timestamp, and parsed-profile summary.
- Returns a structured `422 Unprocessable Entity` response for Markdown format problems, including all detected validation messages.

The service parses and validates the document before persistence. It then uploads the original document to private Storage, opens a database transaction to create the document revision, parsed profile, and skills, and activates the new profile only within that transaction. If the database transaction fails, the service deletes the newly uploaded Storage object. If cleanup also fails, it records the object path for an operational cleanup job; it never activates a partial profile.

## Markdown Contract

The MVP accepts a single candidate document with these headings:

```md
# Name

## Headline
...

## Summary
...

## Experience
...

## Skills
- TypeScript
- PostgreSQL

## Career Preferences
...
```

`# Name` and `## Skills` are required. `Headline`, `Summary`, `Experience`, and `Career Preferences` are optional but recognized. Unknown sections are preserved neither as structured fields nor errors in this MVP.

The parser preserves free text in recognized narrative sections. Skill normalization trims whitespace, deduplicates case-insensitively using a lowercase canonical key, and retains the first supplied display label. The parser returns explicit validation issues rather than attempting LLM-assisted repair.

## Security and Privacy

- Candidate documents are private and must never enter version control.
- No service-role key is available to client code.
- RLS protects database records and Storage policies protect raw documents.
- API errors must not include document content unless explicitly safe and necessary.
- File size and content decoding limits protect the parser from oversized input.

## Test Strategy

- Unit tests for valid and invalid Markdown parsing, skill normalization, and validation messages.
- Unit tests for `ProfileService` revision and activation behavior using storage and repository fakes.
- Integration tests for authenticated upload validation and candidate isolation.
- Migration tests that verify the one-active-profile constraint and RLS policies.
- Fixtures use fictional candidate content only.

## Deferred Decisions

- Profile document download and revision listing endpoints.
- Rich structured parsing for employment records, projects, and education.
- Fine-grained skill taxonomy and proficiency inference.
- Frontend upload experience.
