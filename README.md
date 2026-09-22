# Job Scrapper

Personal AI-powered job search assistant.

## Development

Copy `.env.example` to `.env`, provide your Supabase project URL and publishable key, then run `npm run dev`.

Candidate profiles and credentials are private. Do not commit them.

## Database migration

The candidate profile migration is already applied to the configured Supabase project. Future schema changes must be created with `npx supabase migration new <name>`, reviewed, and explicitly approved before remote deployment.

## Upload a candidate profile

The API accepts one UTF-8 Markdown file through an authenticated multipart request:

```bash
curl --request POST http://localhost:3000/v1/profile/document \
  --header "Authorization: Bearer <user-access-token>" \
  --form "document=@./private/candidate.md;type=text/markdown"
```

The document must have a `.md` filename and include `# Name` and `## Skills` headings. Uploaded source documents are stored in the private `candidate-profile-documents` bucket. The API uses the caller's Supabase access token for both Storage and database operations, so RLS prevents access to other candidates' data.

## Job source boundary

Source modules such as future LinkedIn, Jobstreet, or Glints adapters must only collect external records and yield `RawJobInput` values through the `JobSourceAdapter` interface. They must not import Supabase or matching services. `JobIngestionService` performs deterministic URL canonicalization, checksums, normalization, and persistence through the authenticated repository.
