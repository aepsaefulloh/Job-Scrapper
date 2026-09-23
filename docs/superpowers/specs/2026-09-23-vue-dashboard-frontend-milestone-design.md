# Design Specification: Vue Dashboard Frontend Milestone & Monorepo Restructure

## 1. Overview

This document specifies the technical design for the frontend milestone of the Job Scrapper / Application Assistant project. The project is transitioned into a monorepo structure containing `backend/` (Express API, Supabase integration, scrapers, matching engine, AI assistant) and `frontend/` (Vue 3, Vite, Tailwind CSS, TypeScript, Supabase Auth).

The visual direction follows the editorial, high-contrast, warm theme demonstrated in the project UI reference image ("JobToolkit").

---

## 2. Architecture & Monorepo Structure

### 2.1 Monorepo Layout
```text
Job-Scrapper/
├── backend/
│   ├── src/                    # Express application, AI adapters, services, domain, repositories
│   │   ├── app.ts              # API routers (/api and root backward-compatible endpoints)
│   │   ├── server.ts           # Server bootstrap and service wiring
│   │   └── ...
│   ├── tests/                  # Integration and unit tests (42 suites)
│   ├── package.json            # Backend dependencies, scripts (test, build, typecheck, dev)
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── .env                    # Backend configuration (Supabase, SumoPod, Scraping)
├── frontend/
│   ├── src/
│   │   ├── assets/             # SVG icons, logo assets
│   │   ├── styles/
│   │   │   └── index.css       # Semantic CSS variables and Tailwind utilities
│   │   ├── types/
│   │   │   ├── api.ts          # Generic API responses, pagination, errors
│   │   │   ├── job.ts          # Job, skill, match recommendation interfaces
│   │   │   ├── application.ts  # Application, material, status interfaces
│   │   │   └── profile.ts      # Candidate profile, skill interfaces
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client initialization for Auth
│   │   │   └── api.ts          # Centralized authenticated HTTP client
│   │   ├── composables/
│   │   │   ├── useAuth.ts      # Authentication state and helpers
│   │   │   ├── useJobs.ts      # Job querying, filtering, pagination
│   │   │   ├── useApplications.ts # Application tracking, updates, AI generation
│   │   │   ├── useProfile.ts   # Candidate profile and document upload
│   │   │   └── useMatching.ts  # Match scoring and recommendations
│   │   ├── components/
│   │   │   ├── common/         # LoadingSkeleton, EmptyState, ErrorState, Modal, Toast
│   │   │   ├── navigation/     # AppShell, Sidebar, MobileDrawer, PageHeader, UserMenu
│   │   │   ├── jobs/           # JobRow, JobCard, SkillTag, MatchScoreRing, JobFilterBar
│   │   │   ├── applications/   # ApplicationRow, StatusBadge, ApplicationTimeline
│   │   │   └── materials/      # MaterialCard, MaterialEditor, QuestionAnswerModal
│   │   ├── layouts/
│   │   │   ├── AppLayout.vue   # Persistent sidebar + main scrollable content canvas
│   │   │   └── AuthLayout.vue  # Clean, centered authentication layout
│   │   ├── views/
│   │   │   ├── OverviewView.vue      # `/` (Metrics, Top Matches, Recent Jobs, Status)
│   │   │   ├── JobsView.vue          # `/jobs` (Search, Filters, Job listing)
│   │   │   ├── JobDetailView.vue     # `/jobs/:id` (Description, Requirements, AI triggers)
│   │   │   ├── ApplicationsView.vue  # `/applications` (Status tabs, Application list)
│   │   │   ├── ApplicationDetailView.vue # `/applications/:id` (Materials generator & history)
│   │   │   ├── ProfileView.vue       # `/profile` (Candidate summary, skills, upload)
│   │   │   └── LoginView.vue         # `/login` (Supabase Auth sign-in)
│   │   ├── router/
│   │   │   └── index.ts        # Vue Router with authenticated route guards
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json            # Frontend dependencies and scripts
│   ├── tsconfig.json
│   ├── vite.config.ts          # Vite configuration with /api reverse proxy
│   ├── tailwind.config.ts      # Tailwind CSS configuration with design tokens
│   └── postcss.config.js
├── package.json                # Monorepo root workspace coordinator
├── AGENTS.md
└── README.md
```

### 2.2 Root Workspace Scripts
The monorepo root `package.json` configures npm/bun workspaces:
```json
{
  "name": "job-scrapper-monorepo",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=backend & npm run dev --workspace=frontend",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "test": "npm run test --workspace=backend && npm run test --workspace=frontend",
    "test:backend": "npm run test --workspace=backend",
    "test:frontend": "npm run test --workspace=frontend",
    "typecheck": "npm run typecheck --workspace=backend && npm run typecheck --workspace=frontend",
    "build": "npm run build --workspace=backend && npm run build --workspace=frontend"
  }
}
```

---

## 3. Backend API Enhancements

### 3.1 Route Prefixing & Backward Compatibility
In `backend/src/app.ts`:
- All routes (`/jobs`, `/applications`, `/matching`, `/v1/profile/document`) are mounted under an Express router mounted at both `/api` and `/`.
- This ensures frontend requests to `/api/*` are natively serviced while all existing test suites targeting `/jobs` etc. pass without modification.

### 3.2 Candidate Profile Endpoint (`GET /api/profile`)
- `GET /api/profile` (authenticated):
  - Fetches the active profile and skills for the authenticated candidate (`res.locals.auth.userId`).
  - Response payload:
    ```json
    {
      "id": "uuid",
      "displayName": "Aep Saefulloh",
      "headline": "Full Stack Engineer",
      "summary": "...",
      "experience": "...",
      "careerPreferences": "...",
      "skills": [
        { "displayName": "Vue.js", "canonicalName": "vuejs" },
        { "displayName": "TypeScript", "canonicalName": "typescript" }
      ],
      "updatedAt": "2026-09-23T..."
    }
    ```
  - If no profile exists yet, returns a 404 or empty profile object with `hasProfile: false` so the frontend can display the profile onboarding/upload prompt.

---

## 4. Frontend Design System & Tokens

### 4.1 Color System & Tokens
Following the UI reference image:
- **Canvas / Background**: `--color-bg: #FBFBF9;` (Warm editorial off-white)
- **Content Surface**: `--color-surface: #FFFFFF;` (Pure white card background)
- **Muted Surface**: `--color-surface-muted: #F4F4F0;` (Subtle container / tab background)
- **Sidebar**: `--color-sidebar: #18181B;` (Dark charcoal zinc-900)
- **Sidebar Hover / Active**: `--color-sidebar-active: #27272A;` (Pill active highlight)
- **Borders**: `--color-border: #EAEAE5;` (Restrained warm gray)
- **Text Main**: `--color-text: #1C1917;` (Stone-900)
- **Text Muted**: `--color-text-muted: #78716C;` (Stone-500)
- **Accent Primary**: `--color-primary: #15803D;` (Muted deep emerald green, `emerald-700`)
- **Accent Light**: `--color-primary-light: #ECFDF5;` (`emerald-50`)

### 4.2 Status Badge Colors
- `Saved`: `bg-stone-100 text-stone-700 border-stone-200`
- `Applied`: `bg-blue-50 text-blue-700 border-blue-200`
- `Interview`: `bg-purple-50 text-purple-700 border-purple-200`
- `Offer`: `bg-emerald-50 text-emerald-700 border-emerald-200`
- `Rejected`: `bg-rose-50 text-rose-700 border-rose-200`

### 4.3 Typography & Components
- **Font**: Inter / system sans-serif with tight character tracking on headings and numerical figures.
- **Match Score Ring**: SVG circle with dynamic `stroke-dasharray` and `stroke-dashoffset` rendering the exact matching percentage in deep green/amber.
- **Micro-interactions**: Subtle hover translations, smooth transitions on tabs and filters.

---

## 5. View Specifications

### 5.1 Overview (`/`)
- **Hero Greeting**: "Good morning, [Name] 👋" with subtext.
- **Top Metrics Row**:
  - `New jobs this week` (with status badge)
  - `Saved jobs` (bookmark icon)
  - `Applications` (document icon)
  - `Interviews` (calendar icon)
- **Main Feed**:
  - Tabs: `For You` (sorted by matching engine recommendation score), `Latest` (recent jobs), `Saved` (saved applications).
  - List of job rows with company logo, title, location, skill chips, and circular match percentage ring.
- **Right Rail**:
  - `Keep going` card with application count motivational note.
  - `Profile Completeness` donut card with link to `/profile`.
  - `Tips for you` recommendation list.

### 5.2 Jobs Discovery (`/jobs`)
- **Search & Filters**: Search input for title/keyword, company filter, source filter (`jobstreet`, etc.).
- **Job List**: Paginated list with pagination controls (limit, offset, total count).
- **Row Actions**: Click row to view `/jobs/:id`, quick bookmark/save button.

### 5.3 Job Detail (`/jobs/:id`)
- **Breadcrumbs**: `← Jobs > [Job Title]`
- **Header Banner**: Office/abstract header illustration, company avatar, job title, location, employment type, workplace type.
- **Actions**:
  - Match Score Ring.
  - "Save Job" button.
  - "Create Application" button (or "View Application" if already existing).
- **Tabs**: `Overview`, `About`, `Requirements`, `Benefits`.
- **Content Grid**: Left 2/3 description & skills; Right 1/3 company info and metadata.
- **AI Assistant Section**:
  - 3 action cards: "Cover Letter", "Introduction", "Answer Questions".
  - Clicking any action opens or redirects to material generation for this job.

### 5.4 Applications Tracker (`/applications`)
- **Status Filter Tabs**: `All (N)`, `Saved (N)`, `Applied (N)`, `Interview (N)`, `Offer (N)`, `Rejected (N)`.
- **Action**: `+ Add Application` button opening job selector modal.
- **Table / List**: Rows showing job title, company, location, status badge, applied date, and "View" action button.
- **Footer**: "Progress, not perfection. Every application is a step forward." subtle card.

### 5.5 Application Detail & AI Generator (`/applications/:id`)
- **Job Details Summary**: Direct link back to job.
- **Status Selector**: Instant status updating dropdown with date updated.
- **Notes Editor**: Notes textarea with auto-save / save button.
- **AI Generator Interface**:
  - **Left Controls**:
    - Material Type selector (Cover Letter, Introduction, Recruiter Answer).
    - Tone selector radio buttons (`Professional`, `Conversational`, `Enthusiastic`, `Concise`).
    - Focus / context input field or Question input (for Recruiter Answer).
    - "✨ Generate with AI" button with loading spinner.
  - **Right Preview**:
    - Formatted generated draft.
    - "Copy to Clipboard" action button.
    - Direct in-place editing textarea to customize before finalizing.
    - Disclaimer: "This is an AI-generated draft. Please review and personalize before sending."

### 5.6 Profile View (`/profile`)
- **Candidate Header**: Full name, headline, avatar.
- **Profile Sections**: Professional summary, key skills tags grouped canonically, experience timeline, career preferences.
- **Markdown Document Uploader**:
  - Drag-and-drop file upload zone for `.md` profile document.
  - Submits to `POST /api/v1/profile/document`.
  - Displays instant validation errors or parsing success details.

### 5.7 Authentication (`/login`)
- Dedicated login page in `AuthLayout`.
- Supabase Auth sign-in with email and password.
- Convenient pre-fill switch for local development.
- Automatic session check and redirect back to previous route.

---

## 6. Centralized API Client & Composables

### 6.1 `src/lib/api.ts`
- Centralized `apiClient` instance wrapping native `fetch`:
  - Automatically fetches the active Supabase JWT session token (`supabase.auth.getSession()`).
  - Sets `Authorization: Bearer <token>`.
  - Sets standard headers (`Content-Type: application/json`).
  - Standardizes error responses: maps HTTP error codes (`401`, `404`, `422`, `503`) to typed `ApiClientError` objects with user-friendly error messages.

### 6.2 Composable Architecture
- `useAuth()`: Provides `user`, `session`, `loading`, `login(email, password)`, `logout()`.
- `useJobs()`: Manages `jobs`, `pagination`, `filters`, `loading`, `error`, `fetchJobs(params)`, `fetchJobDetail(id)`.
- `useApplications()`: Manages application list, status filters, creating an application, updating status/notes, and generating materials.
- `useProfile()`: Manages active profile data, skills list, upload state, and upload mutation.

---

## 7. Testing & Verification

### 7.1 Backend Tests
- All 42 existing test suites (105 tests) remain intact and pass in `backend/`.
- New integration tests for `GET /api/profile` and `/api` prefix router mounting.

### 7.2 Frontend Tests
- Vitest + `@vue/test-utils` testing:
  - `useAuth`: session checking and authentication header inclusion.
  - `JobRow`: rendering of job title, company, skills, and match percentage ring.
  - `StatusBadge`: correct styling classes per status.
  - `ApplicationsView`: status tab filtering.
  - `MaterialEditor`: generation trigger, error handling, copy button.
  - Route navigation guards: unauthenticated access redirects to `/login`.

### 7.3 Verification Commands
```powershell
# Root verification
npm run test
npm run typecheck
npm run build
```
