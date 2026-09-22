# Candidate Profile System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated Express API that accepts a private Markdown candidate profile, retains revisioned source documents in Supabase Storage, and persists a deterministic structured profile for later matching.

**Architecture:** Controllers validate HTTP requests and format responses; `ProfileService` parses before persistence, uploads with a user-scoped Supabase client, and calls one Postgres RPC to create a revision atomically. RLS protects database records and private Storage objects.

**Tech Stack:** Node.js 22, TypeScript strict mode, Express 5, Multer, Zod, Vitest, Supertest, Supabase PostgreSQL, Supabase Storage, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-09-22-candidate-profile-system-design.md`

## Global Constraints

- Write source code, API responses, tests, fixtures, commits, and documentation in English.
- Do not commit candidate documents, access tokens, or Supabase keys.
- Keep controllers limited to authentication, request validation, and HTTP response formatting.
- Parse Markdown and normalize skills deterministically; never use an LLM.
- Use private `candidate-profile-documents` Storage and RLS on every `public` table.
- Preserve every successful upload as a revision and permit exactly one active profile per candidate.
- Use `TO authenticated` plus an ownership predicate in every RLS policy; never use `auth.role()`.

## Review Focus

- A `.md` upload sent as `text/plain` is valid; filename validation, not browser MIME type, controls acceptance.
- UTF-8 BOM and CRLF line endings parse identically to LF-only Markdown.
- Case- and whitespace-variant skills become one canonical skill while retaining the first display label.
- A database-RPC failure after Storage upload removes the uploaded object and does not replace the active profile.
- One authenticated candidate cannot access another candidate's database rows or Storage objects.

---

## File Structure

~~~text
src/
  api/
    controllers/profile-controller.ts
    middleware/authenticate.ts
    middleware/error-handler.ts
    routes/profile-routes.ts
  config/env.ts
  domain/profile/
    markdown-profile-parser.ts
    profile-errors.ts
    profile-types.ts
  infrastructure/supabase/
    database.types.ts
    profile-document-storage.ts
    profile-repository.ts
    supabase-user-client.ts
  services/profile-service.ts
  app.ts
  server.ts
supabase/migrations/                         # contains the CLI-emitted candidate_profile_system migration
tests/
  fixtures/candidate-valid.md
  fixtures/candidate-crlf.md
  unit/config/env.test.ts
  unit/domain/markdown-profile-parser.test.ts
  unit/services/profile-service.test.ts
  integration/api/profile-upload.test.ts
  integration/database/profile-schema.test.ts
.env.example
.gitignore
package.json
tsconfig.json
vitest.config.ts
README.md
~~~

### Task 1: Bootstrap the Strict TypeScript API

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`
- Create: `src/config/env.ts`, `src/app.ts`, `src/server.ts`
- Test: `tests/unit/config/env.test.ts`

**Interfaces:**
- Produces: `loadEnv(input: NodeJS.ProcessEnv): AppEnv`.
- Produces: `createApp(dependencies: AppDependencies): Express`.

- [ ] **Step 1: Initialize Git and install pinned dependencies**

Run:

~~~powershell
git init
npm init -y
npm install express@5 multer@2 zod@4 @supabase/supabase-js@2 dotenv@17
npm install -D typescript@5 tsx@4 vitest@4 supertest@7 @types/node@22 @types/express@5 @types/multer@2 @types/supertest@6
~~~

Set scripts to:

~~~json
{
  "dev": "tsx watch src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "db:types": "supabase gen types typescript --linked > src/infrastructure/supabase/database.types.ts"
}
~~~

- [ ] **Step 2: Write the failing environment test**

~~~ts
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/config/env.js';

describe('loadEnv', () => {
  it('rejects a missing Supabase URL', () => {
    expect(() => loadEnv({ PORT: '3000' })).toThrow('SUPABASE_URL');
  });

  it('returns validated configuration', () => {
    expect(loadEnv({
      PORT: '3000',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      PROFILE_DOCUMENT_MAX_BYTES: '1048576'
    })).toMatchObject({ port: 3000, profileDocumentMaxBytes: 1048576 });
  });
});
~~~

- [ ] **Step 3: Verify the test fails**

Run: `npm test -- tests/unit/config/env.test.ts`

Expected: FAIL because `src/config/env.ts` does not exist.

- [ ] **Step 4: Implement configuration and app composition**

Use Zod to require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; default `PORT` to `3000` and `PROFILE_DOCUMENT_MAX_BYTES` to `1048576`.

~~~ts
export type AppDependencies = Record<string, never>;

export function createApp(_dependencies: AppDependencies) {
  return express().use(express.json());
}
~~~

Set TypeScript `module` and `moduleResolution` to `NodeNext`, `target` to `ES2022`, `strict` and `noUncheckedIndexedAccess` to `true`. Exclude `.env`, candidate Markdown, `node_modules`, `dist`, coverage, and `.supabase` in `.gitignore`.

- [ ] **Step 5: Verify the bootstrap**

Run:

~~~powershell
npm test -- tests/unit/config/env.test.ts
npm run typecheck
npm run build
~~~

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

~~~powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .env.example README.md src tests
git commit -m "chore: bootstrap strict TypeScript API"
~~~

### Task 2: Implement the Deterministic Markdown Parser

**Files:**
- Create: `src/domain/profile/profile-types.ts`, `profile-errors.ts`, `markdown-profile-parser.ts`
- Create: `tests/fixtures/candidate-valid.md`, `tests/fixtures/candidate-crlf.md`
- Test: `tests/unit/domain/markdown-profile-parser.test.ts`

**Interfaces:**
- Produces: `parseCandidateMarkdown(markdown: string): ParsedCandidateProfile`.
- Produces: `NormalizedSkill { displayName, canonicalName }`.

- [ ] **Step 1: Write failing parser tests**

~~~ts
it('parses sections and normalizes duplicate skills', () => {
  expect(parseCandidateMarkdown(validMarkdown).skills).toEqual([
    { displayName: 'TypeScript', canonicalName: 'typescript' },
    { displayName: 'PostgreSQL', canonicalName: 'postgresql' }
  ]);
});

it('reports every missing required section', () => {
  expect(() => parseCandidateMarkdown('## Summary\nExample'))
    .toThrow('missing # Name; missing ## Skills');
});

it('accepts BOM and CRLF input', () => {
  expect(parseCandidateMarkdown('\uFEFF' + crlfMarkdown).displayName).toBe('Ada Lovelace');
});
~~~

- [ ] **Step 2: Verify the parser test fails**

Run: `npm test -- tests/unit/domain/markdown-profile-parser.test.ts`

Expected: FAIL because the parser module is missing.

- [ ] **Step 3: Implement parser contracts and behavior**

Define:

~~~ts
export type ParsedCandidateProfile = {
  displayName: string;
  headline?: string;
  summary?: string;
  experience?: string;
  careerPreferences?: string;
  skills: Array<{ displayName: string; canonicalName: string }>;
};
~~~

Strip UTF-8 BOM, normalize CRLF, recognize `# Name` and `## Headline|Summary|Experience|Skills|Career Preferences` case-insensitively, preserve trimmed narrative text, and parse non-empty `- ` items only from `Skills`. Canonicalize with `trim().toLocaleLowerCase('en-US')`, retain the first display label, and throw `MarkdownProfileValidationError` containing all missing required-section and malformed-skill issues.

- [ ] **Step 4: Verify parser behavior**

Run:

~~~powershell
npm test -- tests/unit/domain/markdown-profile-parser.test.ts
npm test
npm run typecheck
~~~

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

~~~powershell
git add src/domain/profile tests/fixtures tests/unit/domain
git commit -m "feat: parse candidate Markdown profiles"
~~~

### Task 3: Create the Supabase Schema, RLS Policies, and Revision RPC

**Files:**
- Create: the timestamped `candidate_profile_system.sql` migration emitted by the Supabase CLI
- Create: `src/infrastructure/supabase/database.types.ts` via type generation
- Test: `tests/integration/database/profile-schema.test.ts`

**Interfaces:**
- Produces: private bucket `candidate-profile-documents`; tables `candidates`, `profile_documents`, `profiles`, and `profile_skills`.
- Produces: `create_profile_revision(p_storage_path text, p_checksum text, p_byte_size integer, p_parser_version text, p_display_name text, p_headline text, p_summary text, p_experience text, p_career_preferences text, p_skills jsonb)` returning `document_id`, `profile_id`, `uploaded_at`, `checksum`, and `skill_count`.
- Consumed by: Task 4 repository.

- [ ] **Step 1: Generate the migration**

Run:

~~~powershell
npx supabase migration new candidate_profile_system
~~~

Edit only the timestamped migration that command creates.

- [ ] **Step 2: Write the failing database schema test**

Assert that all four tables have RLS and that `profiles_one_active_per_candidate` is a partial unique index:

~~~ts
expect(result.every((row) => row.rowsecurity)).toBe(true);
expect(result.find((row) => row.tablename === 'profiles')?.indexdef)
  .toContain('WHERE ((is_active = true) AND (deleted_at IS NULL))');
~~~

Make the test fail clearly when `SUPABASE_TEST_DATABASE_URL` is absent.

- [ ] **Step 3: Verify the schema test fails**

Run: `npm test -- tests/integration/database/profile-schema.test.ts`

Expected: FAIL because no migration or local test database exists.

- [ ] **Step 4: Implement schema, Storage, RLS, and RPC**

In the generated migration:

1. Create `candidates(id uuid primary key references auth.users(id) on delete cascade)`.
2. Create `profile_documents` with UUID ID, candidate ID, unique Storage path, `checksum char(64)`, positive byte size, parser version, timestamps, and `deleted_at`.
3. Create `profiles` with document reference, narrative fields, `is_active`, timestamps, and `deleted_at`; add the partial unique index.
4. Create `profile_skills` with a unique `(profile_id, canonical_name)` constraint.
5. Create a private `candidate-profile-documents` bucket with a 1 MiB limit and `text/markdown` plus `text/plain` MIME types.
6. Enable RLS on all public tables. Use `TO authenticated` plus `(select auth.uid()) = candidate_id`; on skills use an `exists` subquery through the parent profile.
7. Create `storage.objects` SELECT, INSERT, and DELETE policies restricted to the bucket and `(storage.foldername(name))[1] = (select auth.uid()::text)`.
8. Create the default-security-invoker `public.create_profile_revision` PL/pgSQL RPC. It upserts the calling candidate, deactivates its existing profile, inserts document metadata, profile, and `jsonb_to_recordset` skills in one transaction. Revoke EXECUTE from PUBLIC and grant it to authenticated.

- [ ] **Step 5: Apply locally and generate types**

Run:

~~~powershell
npx supabase start
npx supabase db reset
npx supabase link --project-ref hinimggrlswmmwgylufw
npm run db:types
npm test -- tests/integration/database/profile-schema.test.ts
npx supabase db advisors --local
~~~

Expected: migration applies, generated types compile, schema assertions pass, and all new relevant advisor findings are fixed before proceeding. Do not deploy the migration remotely without explicit approval.

- [ ] **Step 6: Commit**

~~~powershell
git add supabase/migrations src/infrastructure/supabase/database.types.ts tests/integration/database/profile-schema.test.ts
git commit -m "feat: add private candidate profile schema"
~~~

### Task 4: Implement Storage, Repository, and Upload Service

**Files:**
- Create: `src/infrastructure/supabase/supabase-user-client.ts`
- Create: `src/infrastructure/supabase/profile-document-storage.ts`
- Create: `src/infrastructure/supabase/profile-repository.ts`
- Create: `src/services/profile-service.ts`
- Test: `tests/unit/services/profile-service.test.ts`

**Interfaces:**
- Consumes: parser and the Task 3 RPC.
- Produces: `ProfileService.upload(input: UploadProfileInput): Promise<ProfileUploadResult>`.

- [ ] **Step 1: Write service tests with Storage and repository fakes**

~~~ts
it('uploads source Markdown and persists its parsed revision', async () => {
  const result = await service.upload({ candidateId, fileName: 'candidate.md', contents: validMarkdown });

  expect(storage.uploadedPaths).toEqual([expect.stringMatching(new RegExp('^' + candidateId + '/.+\\.md$'))]);
  expect(repository.calls[0]?.profile.skills).toHaveLength(2);
  expect(result.profileId).toBe(profileId);
});

it('removes a newly uploaded object when persistence fails', async () => {
  repository.error = new Error('database unavailable');

  await expect(service.upload({ candidateId, fileName: 'candidate.md', contents: validMarkdown }))
    .rejects.toThrow('database unavailable');

  expect(storage.removedPaths).toEqual(storage.uploadedPaths);
});
~~~

- [ ] **Step 2: Verify service tests fail**

Run: `npm test -- tests/unit/services/profile-service.test.ts`

Expected: FAIL because the adapters and service do not exist.

- [ ] **Step 3: Implement user-scoped Supabase adapters**

Create a user client with the publishable key and request JWT:

~~~ts
createClient(env.supabaseUrl, env.supabasePublishableKey, {
  global: { headers: { Authorization: 'Bearer ' + accessToken } }
});
~~~

The Storage adapter calls `bucket.upload(path, contents, { contentType: 'text/markdown', upsert: false })` and `bucket.remove([path])`. The repository calls `.rpc('create_profile_revision', payload).single()`. Convert Supabase errors to typed infrastructure errors without including file contents. Never use a service-role key.

- [ ] **Step 4: Implement the service compensation sequence**

~~~ts
const parsed = parseCandidateMarkdown(input.contents);
const checksum = createHash('sha256').update(input.contents, 'utf8').digest('hex');
const storagePath = input.candidateId + '/' + randomUUID() + '.md';

await storage.upload(storagePath, input.contents);
try {
  return await repository.createRevision({
    candidateId: input.candidateId,
    storagePath,
    checksum,
    byteSize: Buffer.byteLength(input.contents, 'utf8'),
    parserVersion: '1',
    profile: parsed
  });
} catch (error) {
  await storage.remove(storagePath).catch(() => undefined);
  throw error;
}
~~~

Do not upload anything when parsing fails. Do not modify historical revisions.

- [ ] **Step 5: Verify service behavior**

Run:

~~~powershell
npm test -- tests/unit/services/profile-service.test.ts
npm test
npm run typecheck
~~~

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

~~~powershell
git add src/infrastructure/supabase src/services tests/unit/services
git commit -m "feat: store revisioned candidate profiles"
~~~

### Task 5: Expose the Authenticated Multipart Upload Endpoint

**Files:**
- Create: `src/api/middleware/authenticate.ts`, `error-handler.ts`
- Create: `src/api/controllers/profile-controller.ts`, `src/api/routes/profile-routes.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/api/profile-upload.test.ts`

**Interfaces:**
- Consumes: `ProfileService.upload` and user-scoped Supabase client.
- Produces: `POST /v1/profile/document` with one `document` multipart file.

- [ ] **Step 1: Write endpoint contract tests**

~~~ts
it('creates a revision from a Markdown upload', async () => {
  const response = await request(app)
    .post('/v1/profile/document')
    .set('Authorization', 'Bearer test-token')
    .attach('document', Buffer.from(validMarkdown), { filename: 'candidate.md', contentType: 'text/plain' });

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    documentId,
    profileId,
    checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    skillCount: 2
  });
});

it('returns all Markdown issues as 422', async () => {
  const response = await request(app)
    .post('/v1/profile/document')
    .set('Authorization', 'Bearer test-token')
    .attach('document', Buffer.from('## Summary\nMissing sections'), { filename: 'candidate.md' });

  expect(response.status).toBe(422);
  expect(response.body.issues).toEqual(['missing # Name', 'missing ## Skills']);
});
~~~

Also test: missing token is 401, missing document is 400, non-`.md` name is 400, file over configured maximum is 413, and the service receives the authenticated user ID.

- [ ] **Step 2: Verify endpoint tests fail**

Run: `npm test -- tests/integration/api/profile-upload.test.ts`

Expected: FAIL because routes and middleware do not exist.

- [ ] **Step 3: Implement authentication and typed errors**

Extract `Bearer <token>`, create the user-scoped client, and call `supabase.auth.getUser()`. On missing, malformed, or invalid tokens, return:

~~~json
{ "error": { "code": "UNAUTHENTICATED", "message": "Authentication is required." } }
~~~

Map `MarkdownProfileValidationError` to 422 with an `issues` array, invalid upload to 400, Multer `LIMIT_FILE_SIZE` to 413, and infrastructure failures to 502. Never expose stacks or Markdown content.

- [ ] **Step 4: Implement the controller and route**

Configure Multer memory storage with `files: 1` and the configured byte limit. Require the `document` field and case-insensitive `.md` suffix. Decode with `new TextDecoder('utf-8', { fatal: true })`; reject invalid encoding. Call the service with authenticated candidate ID, original filename, and decoded text. Register the route before the shared error handler.

- [ ] **Step 5: Verify the HTTP layer**

Run:

~~~powershell
npm test -- tests/integration/api/profile-upload.test.ts
npm test
npm run typecheck
npm run build
~~~

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

~~~powershell
git add src/api src/app.ts tests/integration/api
git commit -m "feat: add candidate profile upload API"
~~~

### Task 6: Verify Isolation and Document Local Operation

**Files:**
- Modify: `tests/integration/database/profile-schema.test.ts`
- Modify: `tests/integration/api/profile-upload.test.ts`
- Modify: `README.md`, `.env.example`

**Interfaces:**
- Consumes: all completed application and schema components.
- Produces: repeatable setup instructions and final security evidence.

- [ ] **Step 1: Add cross-candidate RLS and Storage tests**

Create two JWT-scoped local Supabase clients. Assert candidate A cannot select candidate B's profiles or documents, cannot insert under B's first-level folder, and cannot delete B's object; assert candidate A can upload and read its own object.

- [ ] **Step 2: Verify isolation tests reveal any missing ownership policy**

Run: `npm test -- tests/integration/database/profile-schema.test.ts`

Expected: FAIL if a table or Storage policy lacks the required ownership predicate.

- [ ] **Step 3: Correct only required local policy defects**

Edit the generated migration, then run `npx supabase db reset`. Do not patch a remote database manually and do not deploy this migration without explicit approval.

- [ ] **Step 4: Write English local-operation documentation**

Add to `README.md`:

~~~md
## Local setup

cp .env.example .env
npm install
npx supabase start
npx supabase db reset
npm run dev

## Upload a candidate profile

curl --request POST http://localhost:3000/v1/profile/document \
  --header "Authorization: Bearer <user-access-token>" \
  --form "document=@./private/candidate.md;type=text/markdown"
~~~

Document that candidate Markdown is private, the bucket is private, uploads require a valid user access token, and production deployment requires separate approval.

- [ ] **Step 5: Run final verification**

Run:

~~~powershell
npx supabase db reset
npx supabase db advisors --local
npm test
npm run typecheck
npm run build
~~~

Expected: migration applies cleanly, no new relevant advisor findings remain, and every test, type check, and build command exits 0.

- [ ] **Step 6: Commit**

~~~powershell
git add README.md .env.example supabase/migrations tests
git commit -m "docs: document secure candidate profile setup"
~~~

## Plan Self-Review

### Spec coverage

- Revisioned private source Markdown: Tasks 3 and 4.
- Deterministic parsing and normalized skills: Task 2.
- One active profile and immutable history: Task 3 RPC and Task 4 orchestration.
- Authenticated upload and validation: Task 5.
- RLS and private Storage: Tasks 3 and 6.
- Failure compensation: Task 4.
- Fictional fixtures and required tests: Tasks 1 through 6.

### Placeholder scan

No task contains an unspecified interface, deferred implementation, or generic error-handling instruction.

### Type consistency

Task 2 defines `ParsedCandidateProfile`; Task 4 passes it to the repository; Task 3's RPC persists it; Task 5 exposes only the resulting summary. `ProfileUploadResult` is produced by the repository and returned by the controller.

### Review-focus coverage

- `text/plain` Markdown: Task 5.
- BOM and CRLF: Task 2.
- Duplicate skills: Tasks 2 and 4.
- Storage cleanup: Task 4.
- Cross-candidate isolation: Task 6.
