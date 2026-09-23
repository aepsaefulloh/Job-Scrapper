# JobToolkit / Job Scrapper

Personal AI-powered job search assistant and application workspace.

## Monorepo Architecture

The repository is structured as a monorepo containing:
- `backend/`: Node.js / Express API, PostgreSQL/Supabase, pgvector embeddings, SumoPod AI adapters, Jobstreet scrapers, and matching engine.
- `frontend/`: Vue 3 + Vite + Tailwind CSS dashboard ("JobToolkit") implementing an editorial, high-contrast, warm theme with Supabase Auth.

## Getting Started

### 1. Environment Setup

- Backend: Copy `backend/.env.example` to `backend/.env` and ensure your Supabase, SumoPod AI, and scraper paths are configured.
- Frontend: Copy `frontend/.env.example` to `frontend/.env`.

### 2. Running in Development

Run both backend and frontend concurrently:
```bash
# Run backend (port 3030)
npm run dev:backend

# Run frontend (port 5173 with /api reverse proxy to 3030)
npm run dev:frontend
```

### 3. Verification & Testing

```bash
# Run all backend and frontend tests
npm run test

# Run TypeScript typechecks across both workspaces
npm run typecheck

# Run production build
npm run build
```

## Features

- **Dashboard Overview (`/`)**: Real-time metrics (new jobs, saved, applications, interviews), "For You" matching recommendations feed with circular match score rings, latest jobs feed, saved tracker, and profile strength summary.
- **Jobs Workspace (`/jobs`)**: Filterable job catalog by keyword, company, and source with pagination and quick bookmarking.
- **Job Detail (`/jobs/:id`)**: Full editorial layout with job description expander, company info, required skills, and direct AI Assistant triggers.
- **Applications Tracker (`/applications`)**: Status-based application management (`saved`, `applied`, `interview`, `offer`, `rejected`) with notes, status switcher, and "+ Add Application" modal.
- **AI Material Generation (`/applications/:id`)**: Tailored cover letter, recruiter introduction, and question-answering generation powered by SumoPod AI with tone selectors and in-place review/copy editor.
- **Candidate Profile (`/profile`)**: Human-maintained Markdown CV/profile uploader supporting natural converted CV formats (bilingual ID/EN headings, `# Name` in H1, multi-skill aggregation) and verified skills viewer (`GET /api/profile`).
- **Supabase Authentication (`/login`)**: Secure Supabase Auth with dev mode pre-fill helper for local testing.
- **Unified Express Production Serving**: Express backend serves both `/api/*` and the compiled Vue SPA (`frontend/dist`) on `/*` with HTML5 History mode support.

