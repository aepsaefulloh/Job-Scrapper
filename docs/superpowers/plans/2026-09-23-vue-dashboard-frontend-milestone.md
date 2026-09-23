# Vue Dashboard Frontend Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first usable Vue 3 + Tailwind CSS dashboard ("JobToolkit") for the Job Scrapper / Application Assistant project within a clean monorepo (`backend/` + `frontend/`), connected to Express APIs and Supabase Auth.

**Architecture:** The repository is restructured into a monorepo with `backend/` and `frontend/`. The Express backend mounts an `/api` prefix and provides a `GET /api/profile` endpoint alongside existing job, matching, and application routes. The Vue 3 SPA uses composables for state, a centralized authenticated API client injecting Supabase JWT tokens, and an editorial design following the reference UI.

**Tech Stack:** Vue 3, Vite, TypeScript, Tailwind CSS, Vue Router, Supabase Auth (@supabase/supabase-js), Express 5, Vitest, @vue/test-utils.

## Global Constraints

- Backend business logic must not be moved or duplicated in the frontend.
- Do not use Pinia, Nuxt, React, or Docker.
- Express routes must support `/api` while maintaining backward compatibility for existing endpoints.
- All colors and styling must adhere to the editorial design tokens: dark charcoal sidebar, warm off-white canvas, white cards, muted deep green accent, restrained shadows, compact radius.
- Skeletons must be used for loading states; no raw backend errors or fake metrics.
- Every important workflow must have automated tests.

---

### Task 1: Restructure Repository into Monorepo (`backend/` & Root Workspaces)

**Files:**
- Create: `backend/` directory
- Move: `src/` -> `backend/src/`
- Move: `tests/` -> `backend/tests/`
- Move: `package.json` -> `backend/package.json`
- Move: `tsconfig.json` -> `backend/tsconfig.json`
- Move: `vitest.config.ts` -> `backend/vitest.config.ts`
- Create: `package.json` (monorepo root workspace coordinator)
- Modify: `backend/src/config/env.ts` (ensure env paths work smoothly)

**Interfaces:**
- Root `npm test` delegates to workspaces.
- Root `npm run build` builds backend and frontend.

- [ ] **Step 1: Move existing backend files to `backend/`**
Move `src/`, `tests/`, `package.json`, `tsconfig.json`, `vitest.config.ts` to `backend/`. Copy `.env` to `backend/.env`.

- [ ] **Step 2: Create root `package.json` with workspace configuration**
```json
{
  "name": "job-scrapper-monorepo",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=backend",
    "dev:all": "npm run dev --workspace=backend & npm run dev --workspace=frontend",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "test": "npm run test --workspace=backend",
    "test:backend": "npm run test --workspace=backend",
    "test:frontend": "npm run test --workspace=frontend",
    "typecheck": "npm run typecheck --workspace=backend",
    "build": "npm run build --workspace=backend"
  }
}
```

- [ ] **Step 3: Run backend tests to verify restructuring**
Run: `npm run test:backend`
Expected: 42 test suites pass.

- [ ] **Step 4: Commit**
```bash
git add backend package.json
git commit -m "refactor: restructure project into monorepo with backend directory"
```

---

### Task 2: Implement `GET /api/profile` and `/api` Routing in Backend

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/services/profile-service.ts`
- Modify: `backend/src/infrastructure/supabase/profile-repository.ts`
- Test: `backend/tests/integration/api/profile-api.test.ts`
- Test: `backend/tests/integration/api/api-prefix.test.ts`

**Interfaces:**
- Consumes: Supabase `profiles` and `profile_skills` tables.
- Produces: `GET /api/profile` returning `{ id, displayName, headline, summary, experience, careerPreferences, skills: Array<{ displayName, canonicalName }> }` and mounts all routes under `/api/*` as well as root.

- [ ] **Step 1: Write integration tests for `GET /api/profile` and `/api` prefix**
Create `backend/tests/integration/api/profile-api.test.ts` and `backend/tests/integration/api/api-prefix.test.ts` asserting `GET /api/profile` returns active profile data with skills and `GET /api/jobs` succeeds.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:backend -- tests/integration/api/profile-api.test.ts`
Expected: FAIL (route not found).

- [ ] **Step 3: Add `getProfile` method to `ProfileRepository` and `ProfileService`**
In `backend/src/infrastructure/supabase/profile-repository.ts`:
Add `getActiveProfile(candidateId: string): Promise<CandidateProfileDetail | null>`.
In `backend/src/services/profile-service.ts`:
Add `getActiveProfile(candidateId: string): Promise<CandidateProfileDetail | null>`.

- [ ] **Step 4: Update `backend/src/app.ts` to mount router on `/api` and `/`**
Mount an Express router containing all endpoints at both `/api` and `/`. Add `GET /profile` (available as `/api/profile` and `/profile`) handler.

- [ ] **Step 5: Run tests to verify all tests pass**
Run: `npm run test:backend`
Expected: All tests pass including new profile and api-prefix tests.

- [ ] **Step 6: Commit**
```bash
git add backend/
git commit -m "feat(backend): add /api prefix support and GET /api/profile endpoint"
```

---

### Task 3: Initialize `frontend/` with Vue 3, Vite, Tailwind CSS, TypeScript, and Design Tokens

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/postcss.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/styles/index.css`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/main.ts`
- Test: `frontend/src/components/__tests__/DesignTokens.test.ts`

**Interfaces:**
- Vite configured with `@` alias to `frontend/src` and proxy `/api` -> `http://localhost:3000`.
- Tailwind configured with semantic tokens: `--color-bg`, `--color-surface`, `--color-sidebar`, `--color-primary`, `--color-border`.

- [ ] **Step 1: Create frontend configuration and dependencies**
Set up `frontend/package.json` with Vue 3, Vue Router, @supabase/supabase-js, Lucide icons (or bespoke inline SVGs), Tailwind CSS, PostCSS, Autoprefixer, Vite, Vitest, `@vue/test-utils`.

- [ ] **Step 2: Configure `frontend/tailwind.config.ts` and `frontend/src/styles/index.css`**
Set up custom colors matching reference image (`#FBFBF9` background, `#18181B` sidebar, `#15803D` primary emerald, `#EAEAE5` borders, Inter typography).

- [ ] **Step 3: Setup Vite dev server proxy**
In `frontend/vite.config.ts`, configure proxy for `/api` targeting `http://localhost:3000`.

- [ ] **Step 4: Write minimal smoke test for frontend mounting**
Write test in `frontend/src/__tests__/App.test.ts`.

- [ ] **Step 5: Run test and build to verify setup**
Run: `npm run test:frontend && npm run build --workspace=frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/
git commit -m "feat(frontend): initialize vue 3, vite, tailwind css with design tokens"
```

---

### Task 4: Implement Supabase Auth, Centralized API Client, and Auth Composable

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/composables/useAuth.ts`
- Create: `frontend/src/views/LoginView.vue`
- Create: `frontend/src/layouts/AuthLayout.vue`
- Create: `frontend/src/router/index.ts`
- Test: `frontend/src/lib/__tests__/api.test.ts`
- Test: `frontend/src/composables/__tests__/useAuth.test.ts`

**Interfaces:**
- `src/lib/api.ts`: `apiClient.get<T>(url, options)`, `apiClient.post<T>(url, body)`, `apiClient.patch<T>(url, body)`. Injects Supabase JWT access token into `Authorization: Bearer <token>`.
- `useAuth`: `user`, `session`, `loading`, `signInWithPassword(email, password)`, `signOut()`, `setDevSession(token, user)`.
- Router navigation guard checks `meta.requiresAuth` and redirects unauthenticated users to `/login`.

- [ ] **Step 1: Write tests for `api.ts` authenticated requests and error mapping**
Test that `apiClient` adds `Authorization` header when session is present and throws `ApiClientError` on HTTP failures.

- [ ] **Step 2: Implement `src/lib/supabase.ts` and `src/lib/api.ts`**
Initialize Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Create `apiClient` with typed methods.

- [ ] **Step 3: Implement `useAuth.ts` composable and `router/index.ts`**
Create reactive auth state with `supabase.auth.onAuthStateChange` listener and navigation guard.

- [ ] **Step 4: Implement `LoginView.vue` with Supabase Auth and dev switcher**
Create clean, editorial sign-in page matching the design system with email/password and quick dev pre-fill.

- [ ] **Step 5: Run tests to verify auth and api client behavior**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/lib frontend/src/composables frontend/src/views/LoginView.vue frontend/src/router
git commit -m "feat(frontend): implement supabase auth, centralized api client, and login view"
```

---

### Task 5: Implement App Layout, JobToolkit Sidebar, and Reusable UI Components

**Files:**
- Create: `frontend/src/layouts/AppLayout.vue`
- Create: `frontend/src/components/navigation/Sidebar.vue`
- Create: `frontend/src/components/navigation/PageHeader.vue`
- Create: `frontend/src/components/common/LoadingSkeleton.vue`
- Create: `frontend/src/components/common/EmptyState.vue`
- Create: `frontend/src/components/common/ErrorState.vue`
- Create: `frontend/src/components/common/MatchScoreRing.vue`
- Create: `frontend/src/components/common/StatusBadge.vue`
- Create: `frontend/src/components/common/SkillTag.vue`
- Test: `frontend/src/components/__tests__/StatusBadge.test.ts`
- Test: `frontend/src/components/__tests__/MatchScoreRing.test.ts`

**Interfaces:**
- `Sidebar.vue`: Persistent charcoal `#18181B` sidebar on desktop, collapsible drawer on mobile. Links to `/`, `/jobs`, `/applications`, `/profile`, `/settings`. Displays current user name ("Aep Saefulloh", "Candidate") and logout.
- `MatchScoreRing.vue`: Props `{ score: number, size?: number }`. Renders circular SVG progress ring in emerald green with percentage text.
- `StatusBadge.vue`: Props `{ status: ApplicationStatus }`. Renders appropriate colored pill badge.

- [ ] **Step 1: Write component tests for `StatusBadge` and `MatchScoreRing`**
Verify classes and SVG calculation for match scores (e.g. 92% -> stroke dash offset, green accent).

- [ ] **Step 2: Implement `MatchScoreRing.vue`, `StatusBadge.vue`, `SkillTag.vue`**
Build components with precision styling matching the reference UI.

- [ ] **Step 3: Implement `LoadingSkeleton.vue`, `EmptyState.vue`, `ErrorState.vue`**
Build editorial shimmer skeletons (cards, list rows) and error callouts with retry triggers.

- [ ] **Step 4: Implement `Sidebar.vue` and `AppLayout.vue`**
Construct desktop dark sidebar with active route indicators and responsive mobile drawer toggle.

- [ ] **Step 5: Run tests to verify component behavior**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/components frontend/src/layouts
git commit -m "feat(frontend): implement app layout, sidebar, and reusable design components"
```

---

### Task 6: Implement Jobs List (`/jobs`) and Job Detail (`/jobs/:id`) Views

**Files:**
- Create: `frontend/src/composables/useJobs.ts`
- Create: `frontend/src/components/jobs/JobRow.vue`
- Create: `frontend/src/components/jobs/JobFilterBar.vue`
- Create: `frontend/src/views/JobsView.vue`
- Create: `frontend/src/views/JobDetailView.vue`
- Test: `frontend/src/views/__tests__/JobsView.test.ts`
- Test: `frontend/src/views/__tests__/JobDetailView.test.ts`

**Interfaces:**
- `useJobs`: `jobs`, `total`, `loading`, `error`, `fetchJobs(params)`, `fetchJobDetail(id)`.
- `JobsView.vue`: Keyword, company, source filter bar; paginated job rows; links to detail.
- `JobDetailView.vue`: Header banner, company info, employment/workplace badges, tabbed sections (Overview, About, Requirements, Benefits), AI Assistant action cards.

- [ ] **Step 1: Write unit tests for `useJobs` composable and `JobsView`**
Verify job fetching, search filter triggering, pagination handling, and row rendering.

- [ ] **Step 2: Implement `useJobs.ts` composable**
Query `/api/jobs` with pagination (`limit`, `offset`) and filters (`keyword`, `company`, `source`). Query `/api/jobs/:id` for detail.

- [ ] **Step 3: Implement `JobRow.vue` and `JobFilterBar.vue`**
JobRow displays company icon, title, location, badges (Full-time, On-site), skill chips, relative time, bookmark button, and `MatchScoreRing`.

- [ ] **Step 4: Implement `JobsView.vue` and `JobDetailView.vue`**
JobDetailView implements full editorial layout from the top-right panel of reference image: header, tabs, description expander, company metadata, and AI Assistant launch cards.

- [ ] **Step 5: Run tests to verify job views**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/views/Jobs* frontend/src/components/jobs frontend/src/composables/useJobs.ts
git commit -m "feat(frontend): implement jobs list and job detail views with filters and match rings"
```

---

### Task 7: Implement Applications Tracker (`/applications`) and Status Workflow

**Files:**
- Create: `frontend/src/composables/useApplications.ts`
- Create: `frontend/src/components/applications/ApplicationRow.vue`
- Create: `frontend/src/components/applications/ApplicationModal.vue`
- Create: `frontend/src/views/ApplicationsView.vue`
- Test: `frontend/src/views/__tests__/ApplicationsView.test.ts`

**Interfaces:**
- `useApplications`: `applications`, `countsByStatus`, `fetchApplications()`, `createApplication(jobId, status, notes)`, `updateApplication(id, updates)`.
- `ApplicationsView.vue`: Status tabs (`All`, `Saved`, `Applied`, `Interview`, `Offer`, `Rejected`) with live badges; table rows with status badge, date, action buttons; "+ Add Application" modal.

- [ ] **Step 1: Write unit test for `useApplications` and status filtering**
Verify tab changes filter applications by status and status update patches the backend.

- [ ] **Step 2: Implement `useApplications.ts` composable**
Queries `GET /api/applications`, `POST /api/applications`, `PATCH /api/applications/:id`. Computes counts per status tab.

- [ ] **Step 3: Implement `ApplicationRow.vue` and `ApplicationModal.vue`**
Row with company avatar, job title, company & location, colored status badge, applied date, and "View" button. Modal allows creating application for any known job.

- [ ] **Step 4: Implement `ApplicationsView.vue`**
Implement the bottom-right panel of the reference UI: header, "+ Add Application" button, status tabs with counts, list rows, and bottom motivational banner.

- [ ] **Step 5: Run tests to verify applications tracker**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/views/ApplicationsView.vue frontend/src/components/applications frontend/src/composables/useApplications.ts
git commit -m "feat(frontend): implement applications tracker with status tabs and creation modal"
```

---

### Task 8: Implement AI Assistant Material Generation UI (`/applications/:id`)

**Files:**
- Create: `frontend/src/components/materials/MaterialGenerator.vue`
- Create: `frontend/src/components/materials/MaterialCard.vue`
- Create: `frontend/src/components/materials/MaterialEditor.vue`
- Create: `frontend/src/views/ApplicationDetailView.vue`
- Test: `frontend/src/components/materials/__tests__/MaterialGenerator.test.ts`

**Interfaces:**
- Supports `POST /api/applications/:id/generate-cover-letter`, `POST /api/applications/:id/generate-introduction`, `POST /api/applications/:id/generate-answer`.
- Form controls: Tone selection radio buttons (`Professional`, `Conversational`, `Enthusiastic`, `Concise`), optional focus input / recruiter question textarea, generate trigger button.
- Preview panel: Editable generated draft, "Copy to Clipboard" button, disclaimer note.

- [ ] **Step 1: Write test for MaterialGenerator component**
Verify tone selection emits payload to API, displays loading spinner during generation, renders draft response, and copies text to clipboard.

- [ ] **Step 2: Implement `MaterialGenerator.vue`**
Replicate bottom-left panel of the reference image: tone selection, focus/question textarea, "✨ Generate with AI", and reviewable generated draft panel.

- [ ] **Step 3: Implement `MaterialCard.vue` and `MaterialEditor.vue`**
Displays existing saved materials (Cover letter, intro, recruiter answers) with edit and copy actions.

- [ ] **Step 4: Implement `ApplicationDetailView.vue`**
Assembles application summary, status switcher dropdown, notes editor, and the AI Material Generator workspace.

- [ ] **Step 5: Run tests to verify AI material generation UI**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/components/materials frontend/src/views/ApplicationDetailView.vue
git commit -m "feat(frontend): implement ai material generator and application detail workspace"
```

---

### Task 9: Implement Dashboard Overview (`/`) with Real Backend Metrics and Feed

**Files:**
- Create: `frontend/src/views/OverviewView.vue`
- Create: `frontend/src/components/dashboard/MetricCard.vue`
- Create: `frontend/src/components/dashboard/ProfileCompletenessCard.vue`
- Create: `frontend/src/composables/useMatching.ts`
- Test: `frontend/src/views/__tests__/OverviewView.test.ts`

**Interfaces:**
- Consumes: `GET /api/jobs`, `GET /api/applications`, `GET /api/matching/jobs/:candidateId`, `GET /api/profile`.
- Produces: Top-left panel of reference image with real live metrics, "For You" matching feed, "Latest" jobs feed, "Saved" applications feed, and right-rail profile summary cards.

- [ ] **Step 1: Write test for `OverviewView` metric computations and tab switching**
Test that metrics accurately reflect job and application counts, and switching between "For You", "Latest", and "Saved" displays the appropriate lists.

- [ ] **Step 2: Implement `useMatching.ts` composable**
Queries `GET /api/matching/jobs/:candidateId` to fetch high-compatibility jobs with similarity, rule score, and AI recommendations.

- [ ] **Step 3: Implement `MetricCard.vue` and `ProfileCompletenessCard.vue`**
Design 4 metric cards (New jobs this week, Saved jobs, Applications, Interviews) and SVG completeness donut.

- [ ] **Step 4: Implement `OverviewView.vue`**
Assemble greeting header, search bar, top metric cards, tabbed feed (For You / Latest / Saved), and right-rail cards ("Keep going", "Your profile match", "Tips for you").

- [ ] **Step 5: Run tests to verify Overview page**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/views/OverviewView.vue frontend/src/components/dashboard frontend/src/composables/useMatching.ts
git commit -m "feat(frontend): implement dashboard overview with live metrics and matching feed"
```

---

### Task 10: Implement Candidate Profile View (`/profile`) and Document Uploader

**Files:**
- Create: `frontend/src/composables/useProfile.ts`
- Create: `frontend/src/components/profile/ProfileUploader.vue`
- Create: `frontend/src/views/ProfileView.vue`
- Test: `frontend/src/views/__tests__/ProfileView.test.ts`

**Interfaces:**
- `useProfile`: `profile`, `loading`, `error`, `fetchProfile()`, `uploadDocument(file)`.
- `ProfileView.vue`: Headline, professional summary, skills list grouped by canonical names, work experience, career preferences, and drag-and-drop Markdown profile upload zone with validation feedback.

- [ ] **Step 1: Write test for `useProfile` and document upload**
Verify parsing success response and error handling for invalid markdown files.

- [ ] **Step 2: Implement `useProfile.ts` composable**
Fetches active profile from `GET /api/profile` and uploads `.md` document to `POST /api/v1/profile/document` with `FormData`.

- [ ] **Step 3: Implement `ProfileUploader.vue`**
Drag-and-drop file upload zone with file type validation (.md) and loading spinner.

- [ ] **Step 4: Implement `ProfileView.vue`**
Editorial profile view displaying candidate headline, summary, skills tags, experience, and uploader drawer.

- [ ] **Step 5: Run tests to verify profile view**
Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/views/ProfileView.vue frontend/src/components/profile frontend/src/composables/useProfile.ts
git commit -m "feat(frontend): implement candidate profile view and markdown document uploader"
```

---

### Task 11: End-to-End Verification, Responsive Polish, Typecheck, and Production Build

**Files:**
- Modify: `backend/package.json` & `frontend/package.json` & root `package.json`
- Modify: `README.md`
- Polish: Responsive drawer and mobile viewports across all views

**Interfaces:**
- Root commands succeed:
  ```powershell
  npm run test
  npm run typecheck
  npm run build
  ```

- [ ] **Step 1: Perform responsive design audit**
Verify drawer navigation on mobile viewports (< 768px), stacked cards, and touch-friendly controls.

- [ ] **Step 2: Run all backend tests**
Run: `npm run test:backend`
Expected: All backend tests pass.

- [ ] **Step 3: Run all frontend tests**
Run: `npm run test:frontend`
Expected: All frontend tests pass.

- [ ] **Step 4: Run typecheck across entire monorepo**
Run: `npm run typecheck`
Expected: Zero TypeScript errors.

- [ ] **Step 5: Run production build across entire monorepo**
Run: `npm run build`
Expected: Successful build in both `backend/dist` and `frontend/dist`.

- [ ] **Step 6: Update `README.md` with monorepo setup and execution instructions**
Document how to run `npm run dev:backend` and `npm run dev:frontend`.

- [ ] **Step 7: Final commit**
```bash
git add .
git commit -m "chore: complete frontend dashboard milestone and monorepo verification"
```
