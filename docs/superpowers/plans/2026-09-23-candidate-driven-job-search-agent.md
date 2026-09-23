# Candidate-Driven Personal Job Search Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded scheduled job search keywords with a candidate-profile-driven search planning system that works for any professional background (not just tech).

**Architecture:** The candidate's Markdown profile generates a persisted `CandidateSearchProfile`. A deterministic `SearchPlanner` converts that profile into `JobSearchIntent[]` using a small role-alias registry. The scheduler consumes those intents instead of hardcoded `JOB_SCRAPE_SEARCHES_JSON`, while all existing concurrency, deduplication, and matching logic remains untouched.

**Tech Stack:** Node.js, TypeScript strict, Express, Supabase PostgreSQL, Zod, Vitest, Vue 3 + Vite.

**Spec:** Milestone prompt in conversation history (2026-09-23).

## Global Constraints

- TypeScript strict mode — no `any`, no non-null assertions without guard
- No LLM calls inside scrapers, normalizers, or the scheduler tick itself
- Search profile must be persisted and reused; do NOT regenerate on every scrape run
- `ScheduledScrapeTask`, concurrency guard, and `ScrapeRunService` remain untouched
- All new code lives under `backend/src/search/` except API wiring in `app.ts`/`server.ts`
- New Supabase tables require migrations under `backend/supabase/migrations/`
- Run `bun test && bun run typecheck && bun run build` before every commit
- Test fixtures must not use real candidate data; use synthetic fixtures only

---

## File Map

### New files — backend

```
backend/src/search/
  search-types.ts                     # CandidateSearchProfile, JobSearchIntent, HardFilterResult
  role-alias-registry.ts              # deterministic alias map + normalize/expand helpers
  query-expander.ts                   # CandidateSearchProfile → expanded keyword list
  search-planner.ts                   # SearchPlanner class → JobSearchIntent[]
  search-profile.service.ts           # SearchProfileService: derive + persist + retrieve
  search-profile.repository.ts        # SupabaseSearchProfileRepository
  eligibility-filter.ts               # applyHardFilters(job, profile) → HardFilterResult
backend/supabase/migrations/
  20260923190000_search_profile.sql   # candidate_search_profiles table + RLS
```

### New files — tests

```
backend/tests/unit/search/
  role-alias-registry.test.ts
  query-expander.test.ts
  search-planner.test.ts
  eligibility-filter.test.ts
  search-profile-service.test.ts
backend/tests/fixtures/
  search-profile-tech.json
  search-profile-finance.json
  search-profile-marketing.json
  search-profile-ops.json
```

### Modified files — backend

```
backend/src/server.ts                 # wire SearchProfileService + update scheduler tick
backend/src/app.ts                    # add GET /search-profile route
backend/src/config/env.ts             # relax JOB_SCRAPE_SEARCHES_JSON requirement (now optional)
```

### New files — frontend

```
frontend/src/types/search-profile.ts
frontend/src/composables/useSearchProfile.ts
frontend/src/components/profile/SearchProfileCard.vue
```

### Modified files — frontend

```
frontend/src/views/ProfileView.vue    # add <SearchProfileCard />
```

---

## Task 1: Types and Role Alias Registry

**Files:**
- Create: `backend/src/search/search-types.ts`
- Create: `backend/src/search/role-alias-registry.ts`
- Create: `backend/tests/unit/search/role-alias-registry.test.ts`

**Interfaces:**
- Produces: `CandidateSearchProfile`, `JobSearchIntent`, `HardFilterInput`, `HardFilterResult` types; `expandRoleAliases(role: string): string[]`; `normalizeKeyword(s: string): string`

---

- [ ] **Step 1.1: Write the failing tests**

```typescript
// backend/tests/unit/search/role-alias-registry.test.ts
import { describe, it, expect } from 'vitest';
import { expandRoleAliases, normalizeKeyword } from '../../../src/search/role-alias-registry.js';

describe('normalizeKeyword', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeKeyword('  HR Manager  ')).toBe('hr manager');
  });
  it('collapses internal whitespace', () => {
    expect(normalizeKeyword('Digital  Marketing')).toBe('digital marketing');
  });
});

describe('expandRoleAliases', () => {
  it('returns aliases for accountant', () => {
    const result = expandRoleAliases('accountant');
    expect(result).toContain('accountant');
    expect(result).toContain('accounting staff');
    expect(result).toContain('finance accounting');
  });
  it('returns aliases for human resources', () => {
    const result = expandRoleAliases('human resources');
    expect(result).toContain('hr');
    expect(result).toContain('hr officer');
    expect(result).toContain('people operations');
  });
  it('returns aliases for frontend developer', () => {
    const result = expandRoleAliases('frontend developer');
    expect(result).toContain('frontend developer');
    expect(result).toContain('frontend engineer');
    expect(result).toContain('web developer');
  });
  it('returns at least the original role when no alias exists', () => {
    const result = expandRoleAliases('some unknown role');
    expect(result).toContain('some unknown role');
  });
  it('deduplicates aliases', () => {
    const result = expandRoleAliases('accountant');
    const unique = new Set(result.map(r => r.toLowerCase()));
    expect(unique.size).toBe(result.length);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```
cd backend && bun test tests/unit/search/role-alias-registry.test.ts
```
Expected: `cannot find module '../../../src/search/role-alias-registry.js'`

- [ ] **Step 1.3: Create search-types.ts**

```typescript
// backend/src/search/search-types.ts

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

export type CandidateSearchProfile = {
  candidateId: string;
  targetRoles: string[];
  roleAliases: string[];
  primarySkills: string[];
  secondarySkills: string[];
  industries: string[];
  experienceYears?: number;
  seniority: string[];
  preferredLocations: string[];
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
  excludedRoles: string[];
  excludedKeywords: string[];
  excludedCompanies: string[];
  languages: string[];
  salaryPreference?: { minimum?: number; currency?: string };
  sources: string[];
  generatedAt: string;
};

export type JobSearchIntent = {
  source: string;
  keyword: string;
  location?: string;
  maxPages?: number;
};

export type HardFilterInput = {
  title: string;
  companyName: string;
  employmentType?: string;
  expiresAt?: string;
  location?: string;
};

export type HardFilterResult =
  | { eligible: true }
  | { eligible: false; reason: string };
```

- [ ] **Step 1.4: Create role-alias-registry.ts**

```typescript
// backend/src/search/role-alias-registry.ts

export function normalizeKeyword(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

const ALIAS_MAP: Record<string, string[]> = {
  accountant: ['accountant', 'accounting staff', 'finance accounting', 'general ledger accountant', 'junior accountant'],
  'human resources': ['human resources', 'hr', 'hr officer', 'hr staff', 'people operations', 'rekrutmen'],
  'hr manager': ['hr manager', 'human resources manager', 'hr officer', 'people manager'],
  recruitment: ['recruitment', 'recruiter', 'talent acquisition', 'hr recruitment'],
  'digital marketing': ['digital marketing', 'digital marketing specialist', 'digital marketing executive', 'performance marketing', 'growth marketing'],
  marketing: ['marketing', 'marketing staff', 'marketing executive', 'marketing officer', 'brand marketing'],
  seo: ['seo', 'seo specialist', 'seo analyst'],
  'content writer': ['content writer', 'content creator', 'copywriter', 'content strategist'],
  'frontend developer': ['frontend developer', 'frontend engineer', 'web developer', 'ui developer', 'vue developer', 'react developer'],
  'backend developer': ['backend developer', 'backend engineer', 'software engineer', 'node.js developer'],
  'software engineer': ['software engineer', 'software developer', 'programmer', 'developer'],
  'data analyst': ['data analyst', 'business analyst', 'junior data analyst', 'analytics'],
  'product manager': ['product manager', 'product owner', 'product management'],
  'project manager': ['project manager', 'project officer', 'project coordinator'],
  finance: ['finance', 'finance staff', 'finance officer', 'finance analyst', 'keuangan'],
  sales: ['sales', 'sales executive', 'sales officer', 'sales representative', 'business development'],
  'customer service': ['customer service', 'customer support', 'cs', 'customer relations'],
  operations: ['operations', 'operational staff', 'operations officer', 'ops'],
  logistics: ['logistics', 'supply chain', 'procurement', 'warehouse'],
  administration: ['administration', 'admin', 'staff administrasi', 'administrator', 'office administration'],
  'graphic designer': ['graphic designer', 'desainer grafis', 'visual designer', 'creative designer'],
  'ui ux designer': ['ui ux designer', 'ui designer', 'ux designer', 'product designer'],
  teacher: ['teacher', 'guru', 'pengajar', 'educator', 'instructor', 'tutor'],
  legal: ['legal', 'legal staff', 'legal officer', 'corporate legal', 'compliance'],
  accounting: ['accounting', 'accountant', 'accounting officer', 'staf akuntansi'],
};

export function expandRoleAliases(role: string): string[] {
  const normalized = normalizeKeyword(role);
  const aliases = ALIAS_MAP[normalized];
  if (!aliases) return [normalized];
  const seen = new Set<string>();
  return aliases.map(normalizeKeyword).filter(a => {
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}
```

- [ ] **Step 1.5: Run tests to verify they pass**

```
cd backend && bun test tests/unit/search/role-alias-registry.test.ts
```
Expected: all pass

- [ ] **Step 1.6: Commit**

```
git add backend/src/search/search-types.ts backend/src/search/role-alias-registry.ts backend/tests/unit/search/role-alias-registry.test.ts
git commit -m "feat(search): add search types and role alias registry"
```

---

## Task 2: Query Expander and Search Planner

**Files:**
- Create: `backend/src/search/query-expander.ts`
- Create: `backend/src/search/search-planner.ts`
- Create: `backend/tests/unit/search/query-expander.test.ts`
- Create: `backend/tests/unit/search/search-planner.test.ts`
- Create: `backend/tests/fixtures/search-profile-tech.json`
- Create: `backend/tests/fixtures/search-profile-finance.json`
- Create: `backend/tests/fixtures/search-profile-marketing.json`
- Create: `backend/tests/fixtures/search-profile-ops.json`

**Interfaces:**
- Consumes: `expandRoleAliases`, `normalizeKeyword` from Task 1; `CandidateSearchProfile`, `JobSearchIntent` from `search-types.ts`
- Produces: `expandKeywords(profile: CandidateSearchProfile): string[]`; `SearchPlanner` class with `createIntents(profile, options?): JobSearchIntent[]`; `createPlan(profile, options?): SearchPlan`

---

- [ ] **Step 2.1: Write fixture files**

```json
// backend/tests/fixtures/search-profile-tech.json
{
  "candidateId": "cand-tech-001",
  "targetRoles": ["Frontend Developer"],
  "roleAliases": [],
  "primarySkills": ["Vue.js", "TypeScript", "React"],
  "secondarySkills": ["CSS", "REST API"],
  "industries": [],
  "seniority": ["junior", "mid"],
  "preferredLocations": ["Jakarta", "Remote"],
  "workModes": ["remote", "hybrid"],
  "employmentTypes": ["full-time"],
  "excludedRoles": ["internship"],
  "excludedKeywords": [],
  "excludedCompanies": [],
  "languages": ["Indonesian", "English"],
  "sources": ["jobstreet"],
  "generatedAt": "2026-09-23T00:00:00.000Z"
}
```

```json
// backend/tests/fixtures/search-profile-finance.json
{
  "candidateId": "cand-finance-001",
  "targetRoles": ["Accountant"],
  "roleAliases": [],
  "primarySkills": ["Microsoft Excel", "Laporan Keuangan", "Rekonsiliasi"],
  "secondarySkills": ["SAP", "Oracle"],
  "industries": ["Finance", "Banking"],
  "seniority": ["mid"],
  "preferredLocations": ["Jakarta"],
  "workModes": ["onsite"],
  "employmentTypes": ["full-time"],
  "excludedRoles": ["internship"],
  "excludedKeywords": [],
  "excludedCompanies": [],
  "languages": ["Indonesian"],
  "sources": ["jobstreet"],
  "generatedAt": "2026-09-23T00:00:00.000Z"
}
```

```json
// backend/tests/fixtures/search-profile-marketing.json
{
  "candidateId": "cand-mkt-001",
  "targetRoles": ["Digital Marketing", "Content Writer"],
  "roleAliases": [],
  "primarySkills": ["SEO", "Google Ads", "Content Strategy"],
  "secondarySkills": ["Canva", "Google Analytics"],
  "industries": [],
  "seniority": ["junior", "mid"],
  "preferredLocations": ["Bandung", "Jakarta"],
  "workModes": ["remote", "hybrid"],
  "employmentTypes": ["full-time", "part-time"],
  "excludedRoles": [],
  "excludedKeywords": [],
  "excludedCompanies": [],
  "languages": ["Indonesian"],
  "sources": ["jobstreet"],
  "generatedAt": "2026-09-23T00:00:00.000Z"
}
```

```json
// backend/tests/fixtures/search-profile-ops.json
{
  "candidateId": "cand-ops-001",
  "targetRoles": ["Administration", "Operations"],
  "roleAliases": [],
  "primarySkills": ["Administrasi Perkantoran", "Microsoft Excel", "Pengarsipan Digital"],
  "secondarySkills": ["Korespondensi Bisnis", "Manajemen Waktu"],
  "industries": [],
  "seniority": ["junior"],
  "preferredLocations": ["Tangerang", "Jakarta"],
  "workModes": ["onsite", "hybrid"],
  "employmentTypes": ["full-time"],
  "excludedRoles": [],
  "excludedKeywords": [],
  "excludedCompanies": [],
  "languages": ["Indonesian"],
  "sources": ["jobstreet"],
  "generatedAt": "2026-09-23T00:00:00.000Z"
}
```

- [ ] **Step 2.2: Write failing tests for query expander**

```typescript
// backend/tests/unit/search/query-expander.test.ts
import { describe, it, expect } from 'vitest';
import { expandKeywords } from '../../../src/search/query-expander.js';
import techProfile from '../../fixtures/search-profile-tech.json';
import financeProfile from '../../fixtures/search-profile-finance.json';
import marketingProfile from '../../fixtures/search-profile-marketing.json';
import opsProfile from '../../fixtures/search-profile-ops.json';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

describe('expandKeywords', () => {
  it('expands tech target role into multiple keywords', () => {
    const keywords = expandKeywords(techProfile as CandidateSearchProfile);
    expect(keywords).toContain('frontend developer');
    expect(keywords).toContain('frontend engineer');
    expect(keywords).toContain('web developer');
  });

  it('expands finance target role into multiple keywords', () => {
    const keywords = expandKeywords(financeProfile as CandidateSearchProfile);
    expect(keywords).toContain('accountant');
    expect(keywords).toContain('accounting staff');
    expect(keywords).toContain('finance accounting');
  });

  it('expands multiple marketing roles', () => {
    const keywords = expandKeywords(marketingProfile as CandidateSearchProfile);
    expect(keywords).toContain('digital marketing');
    expect(keywords).toContain('content writer');
    expect(keywords).toContain('copywriter');
  });

  it('expands ops profile (non-technical)', () => {
    const keywords = expandKeywords(opsProfile as CandidateSearchProfile);
    expect(keywords).toContain('administration');
    expect(keywords).toContain('admin');
    expect(keywords).toContain('operations');
  });

  it('does not return duplicate keywords', () => {
    const keywords = expandKeywords(financeProfile as CandidateSearchProfile);
    const unique = new Set(keywords);
    expect(unique.size).toBe(keywords.length);
  });

  it('does not include excluded roles', () => {
    const keywords = expandKeywords(techProfile as CandidateSearchProfile);
    expect(keywords).not.toContain('internship');
  });
});
```

- [ ] **Step 2.3: Write failing tests for search planner**

```typescript
// backend/tests/unit/search/search-planner.test.ts
import { describe, it, expect } from 'vitest';
import { SearchPlanner } from '../../../src/search/search-planner.js';
import techProfile from '../../fixtures/search-profile-tech.json';
import financeProfile from '../../fixtures/search-profile-finance.json';
import marketingProfile from '../../fixtures/search-profile-marketing.json';
import opsProfile from '../../fixtures/search-profile-ops.json';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

describe('SearchPlanner', () => {
  const planner = new SearchPlanner();

  it('creates intents for tech candidate', () => {
    const intents = planner.createIntents(techProfile as CandidateSearchProfile);
    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(typeof intent.keyword).toBe('string');
      expect(intent.keyword.length).toBeGreaterThan(0);
      expect(typeof intent.source).toBe('string');
    }
  });

  it('creates intents for finance (non-technical) candidate', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('accountant'))).toBe(true);
  });

  it('creates intents for marketing candidate with multiple roles', () => {
    const intents = planner.createIntents(marketingProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('marketing'))).toBe(true);
    expect(keywords.some(k => k.includes('content') || k.includes('copywriter'))).toBe(true);
  });

  it('creates intents for ops candidate (non-technical)', () => {
    const intents = planner.createIntents(opsProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('admin') || k.includes('operations'))).toBe(true);
  });

  it('respects maxIntentsPerRole option', () => {
    const intents = planner.createIntents(marketingProfile as CandidateSearchProfile, { maxIntentsPerRole: 2 });
    // 2 roles * 2 max * 2 locations = 8 max
    expect(intents.length).toBeLessThanOrEqual(8);
  });

  it('attaches location to intents when profile has preferredLocations', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile);
    const withJakarta = intents.filter(i => i.location === 'Jakarta');
    expect(withJakarta.length).toBeGreaterThan(0);
  });

  it('applies defaultMaxPages option', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile, { defaultMaxPages: 3 });
    for (const intent of intents) {
      expect(intent.maxPages).toBe(3);
    }
  });

  it('uses only sources from profile', () => {
    const intents = planner.createIntents(techProfile as CandidateSearchProfile);
    for (const intent of intents) {
      expect((techProfile as CandidateSearchProfile).sources).toContain(intent.source);
    }
  });
});
```

- [ ] **Step 2.4: Run failing tests**

```
cd backend && bun test tests/unit/search/query-expander.test.ts tests/unit/search/search-planner.test.ts
```
Expected: all fail

- [ ] **Step 2.5: Create query-expander.ts**

```typescript
// backend/src/search/query-expander.ts
import { expandRoleAliases, normalizeKeyword } from './role-alias-registry.js';
import type { CandidateSearchProfile } from './search-types.js';

export function expandKeywords(profile: CandidateSearchProfile): string[] {
  const excluded = new Set(profile.excludedRoles.map(normalizeKeyword));
  const seen = new Set<string>();
  const results: string[] = [];

  for (const role of profile.targetRoles) {
    for (const alias of expandRoleAliases(role)) {
      const normalized = normalizeKeyword(alias);
      if (!excluded.has(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        results.push(normalized);
      }
    }
  }

  for (const alias of profile.roleAliases) {
    const normalized = normalizeKeyword(alias);
    if (!excluded.has(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      results.push(normalized);
    }
  }

  return results;
}
```

- [ ] **Step 2.6: Create search-planner.ts**

```typescript
// backend/src/search/search-planner.ts
import { expandKeywords } from './query-expander.js';
import type { CandidateSearchProfile, JobSearchIntent } from './search-types.js';

export type SearchPlanOptions = {
  maxIntentsPerRole?: number;
  defaultMaxPages?: number;
};

export type SearchPlan = {
  candidateId: string;
  intents: JobSearchIntent[];
  generatedAt: string;
};

export class SearchPlanner {
  public createIntents(
    profile: CandidateSearchProfile,
    options: SearchPlanOptions = {}
  ): JobSearchIntent[] {
    const { maxIntentsPerRole = 5, defaultMaxPages = 5 } = options;
    const keywords = expandKeywords(profile).slice(0, profile.targetRoles.length * maxIntentsPerRole);
    const locations = profile.preferredLocations.length > 0 ? profile.preferredLocations : [undefined as string | undefined];
    const intents: JobSearchIntent[] = [];
    const seen = new Set<string>();

    for (const source of profile.sources) {
      for (const keyword of keywords) {
        for (const location of locations) {
          const key = `${source}:${keyword}:${location ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          intents.push({ source, keyword, ...(location ? { location } : {}), maxPages: defaultMaxPages });
        }
      }
    }
    return intents;
  }

  public createPlan(profile: CandidateSearchProfile, options?: SearchPlanOptions): SearchPlan {
    return { candidateId: profile.candidateId, intents: this.createIntents(profile, options), generatedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 2.7: Run tests to verify they pass**

```
cd backend && bun test tests/unit/search/query-expander.test.ts tests/unit/search/search-planner.test.ts
```
Expected: all pass

- [ ] **Step 2.8: Commit**

```
git add backend/src/search/ backend/tests/unit/search/ backend/tests/fixtures/search-profile-*.json
git commit -m "feat(search): add query expander and search planner"
```

---

## Task 3: Eligibility Hard Filter

**Files:**
- Create: `backend/src/search/eligibility-filter.ts`
- Create: `backend/tests/unit/search/eligibility-filter.test.ts`

**Interfaces:**
- Consumes: `CandidateSearchProfile`, `HardFilterInput`, `HardFilterResult` from `search-types.ts`; `normalizeKeyword` from `role-alias-registry.ts`
- Produces: `applyHardFilters(job: HardFilterInput, profile: CandidateSearchProfile): HardFilterResult`

---

- [ ] **Step 3.1: Write failing tests**

```typescript
// backend/tests/unit/search/eligibility-filter.test.ts
import { describe, it, expect } from 'vitest';
import { applyHardFilters } from '../../../src/search/eligibility-filter.js';
import type { CandidateSearchProfile, HardFilterInput } from '../../../src/search/search-types.js';

const baseProfile: CandidateSearchProfile = {
  candidateId: 'test',
  targetRoles: ['Accountant'],
  roleAliases: [],
  primarySkills: ['Excel'],
  secondarySkills: [],
  industries: [],
  seniority: ['mid'],
  preferredLocations: ['Jakarta'],
  workModes: ['onsite'],
  employmentTypes: ['full-time'],
  excludedRoles: ['sales', 'internship'],
  excludedKeywords: ['MLM', 'network marketing'],
  excludedCompanies: ['BlockedCorp'],
  languages: [],
  sources: ['jobstreet'],
  generatedAt: '2026-01-01T00:00:00Z',
};

const validJob: HardFilterInput = {
  title: 'Accountant',
  companyName: 'Good Corp',
  employmentType: 'full-time',
  location: 'Jakarta',
};

describe('applyHardFilters', () => {
  it('allows a valid job', () => {
    expect(applyHardFilters(validJob, baseProfile)).toEqual({ eligible: true });
  });

  it('rejects a job from a blocked company', () => {
    const result = applyHardFilters({ ...validJob, companyName: 'BlockedCorp' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('company');
  });

  it('rejects a job with an excluded role keyword in title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Sales Executive' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('role');
  });

  it('rejects a job with excluded keyword in title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Distributor MLM Produk' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('keyword');
  });

  it('rejects an expired job', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const result = applyHardFilters({ ...validJob, expiresAt: past }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('expired');
  });

  it('does NOT reject a job because a skill is missing', () => {
    const result = applyHardFilters({ ...validJob, title: 'Junior Accountant' }, baseProfile);
    expect(result.eligible).toBe(true);
  });

  it('does NOT reject a related but not identical title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Finance & Accounting Officer' }, baseProfile);
    expect(result.eligible).toBe(true);
  });

  it('rejects internship when excluded', () => {
    const result = applyHardFilters({ ...validJob, title: 'Internship Accounting' }, baseProfile);
    expect(result.eligible).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run failing tests**

```
cd backend && bun test tests/unit/search/eligibility-filter.test.ts
```
Expected: all fail

- [ ] **Step 3.3: Implement eligibility-filter.ts**

```typescript
// backend/src/search/eligibility-filter.ts
import { normalizeKeyword } from './role-alias-registry.js';
import type { CandidateSearchProfile, HardFilterInput, HardFilterResult } from './search-types.js';

export function applyHardFilters(
  job: HardFilterInput,
  profile: CandidateSearchProfile
): HardFilterResult {
  const title = normalizeKeyword(job.title);
  const company = normalizeKeyword(job.companyName);

  for (const blocked of profile.excludedCompanies) {
    if (company === normalizeKeyword(blocked)) {
      return { eligible: false, reason: `Excluded company: ${job.companyName}` };
    }
  }

  for (const role of profile.excludedRoles) {
    if (title.includes(normalizeKeyword(role))) {
      return { eligible: false, reason: `Excluded role keyword in title: ${role}` };
    }
  }

  for (const kw of profile.excludedKeywords) {
    if (title.includes(normalizeKeyword(kw))) {
      return { eligible: false, reason: `Excluded keyword in title: ${kw}` };
    }
  }

  if (job.expiresAt) {
    const expires = new Date(job.expiresAt);
    if (!isNaN(expires.getTime()) && expires < new Date()) {
      return { eligible: false, reason: `Job expired at ${job.expiresAt}` };
    }
  }

  return { eligible: true };
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```
cd backend && bun test tests/unit/search/eligibility-filter.test.ts
```
Expected: all pass

- [ ] **Step 3.5: Commit**

```
git add backend/src/search/eligibility-filter.ts backend/tests/unit/search/eligibility-filter.test.ts
git commit -m "feat(search): add eligibility hard-filter layer"
```

---

## Task 4: Database Migration

**Files:**
- Create: `backend/supabase/migrations/20260923190000_search_profile.sql`

---

- [ ] **Step 4.1: Create migration file**

```sql
-- backend/supabase/migrations/20260923190000_search_profile.sql

create table if not exists candidate_search_profiles (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  profile_data  jsonb not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(candidate_id)
);

alter table candidate_search_profiles enable row level security;

create policy "Candidates own their search profile"
  on candidate_search_profiles
  for all
  using (candidate_id = auth.uid())
  with check (candidate_id = auth.uid());

create index if not exists idx_search_profiles_candidate
  on candidate_search_profiles(candidate_id);
```

> **⚠️ WARNING:** Apply this migration to the remote Supabase project via the dashboard SQL editor before wiring the repository. Confirm with the user before applying.

- [ ] **Step 4.2: Apply migration (user confirms)**

Apply via Supabase dashboard > SQL Editor.

- [ ] **Step 4.3: Commit**

```
git add backend/supabase/migrations/20260923190000_search_profile.sql
git commit -m "feat(db): add candidate_search_profiles table with RLS"
```

---

## Task 5: Search Profile Repository and Service

**Files:**
- Create: `backend/src/search/search-profile.repository.ts`
- Create: `backend/src/search/search-profile.service.ts`
- Create: `backend/tests/unit/search/search-profile-service.test.ts`

**Interfaces:**
- Consumes: `CandidateSearchProfile` from `search-types.ts`; `CandidateProfileDetail` from `profile-repository.ts`
- Produces: `SearchProfileRepository` interface; `SearchProfileService` with `deriveFromProfile(profile, candidateId): CandidateSearchProfile`; `getOrDerive(candidateId, profile): Promise<CandidateSearchProfile>`; `get(candidateId): Promise<CandidateSearchProfile | null>`; `save(profile): Promise<void>`

---

- [ ] **Step 5.1: Write failing tests**

```typescript
// backend/tests/unit/search/search-profile-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SearchProfileService } from '../../../src/search/search-profile.service.js';
import type { SearchProfileRepository } from '../../../src/search/search-profile.repository.js';
import type { CandidateProfileDetail } from '../../../src/infrastructure/supabase/profile-repository.js';

const financeProfile: CandidateProfileDetail = {
  id: 'prof-1',
  candidateId: 'cand-1',
  displayName: 'Budi Santoso',
  headline: 'Staf Akuntansi',
  summary: 'Pengalaman 3 tahun sebagai akuntan di perusahaan manufaktur.',
  experience: 'PT ABC Manufacturing | Akuntan | 2021-2024',
  careerPreferences: null,
  skills: [
    { displayName: 'Microsoft Excel', canonicalName: 'microsoft excel' },
    { displayName: 'Laporan Keuangan', canonicalName: 'laporan keuangan' },
    { displayName: 'Rekonsiliasi', canonicalName: 'rekonsiliasi' },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SearchProfileService', () => {
  describe('deriveFromProfile', () => {
    const mockRepo: SearchProfileRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    };
    const service = new SearchProfileService(mockRepo);

    it('extracts primary skills from profile skills', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.primarySkills).toContain('Microsoft Excel');
    });

    it('derives target roles from headline', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.targetRoles.length).toBeGreaterThan(0);
      expect(result.targetRoles[0]).toContain('Staf Akuntansi');
    });

    it('sets candidateId correctly', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.candidateId).toBe('cand-1');
    });

    it('sets generatedAt to a recent ISO timestamp', () => {
      const before = Date.now();
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      const after = Date.now();
      const ts = new Date(result.generatedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('defaults sources to ["jobstreet"]', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.sources).toContain('jobstreet');
    });

    it('handles profile with no skills gracefully', () => {
      const result = service.deriveFromProfile({ ...financeProfile, skills: [] }, 'cand-1');
      expect(result.primarySkills).toEqual([]);
    });
  });

  describe('getOrDerive', () => {
    it('returns existing profile from repo without saving', async () => {
      const existing = { candidateId: 'cand-1', targetRoles: ['Accountant'], roleAliases: [], primarySkills: [], secondarySkills: [], industries: [], seniority: [], preferredLocations: [], workModes: [], employmentTypes: ['full-time' as const], excludedRoles: [], excludedKeywords: [], excludedCompanies: [], languages: [], sources: ['jobstreet'], generatedAt: '2026-01-01T00:00:00Z' };
      const repoWithExisting: SearchProfileRepository = {
        save: vi.fn(),
        get: vi.fn().mockResolvedValue(existing),
      };
      const svc = new SearchProfileService(repoWithExisting);
      const result = await svc.getOrDerive('cand-1', financeProfile);
      expect(result.candidateId).toBe('cand-1');
      expect(repoWithExisting.save).not.toHaveBeenCalled();
    });

    it('derives and saves when no profile exists', async () => {
      const saveRepo: SearchProfileRepository = {
        save: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
      };
      const svc = new SearchProfileService(saveRepo);
      const result = await svc.getOrDerive('cand-1', financeProfile);
      expect(result.candidateId).toBe('cand-1');
      expect(saveRepo.save).toHaveBeenCalledOnce();
    });
  });
});
```

- [ ] **Step 5.2: Run failing tests**

```
cd backend && bun test tests/unit/search/search-profile-service.test.ts
```
Expected: all fail

- [ ] **Step 5.3: Create search-profile.repository.ts**

```typescript
// backend/src/search/search-profile.repository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import type { CandidateSearchProfile } from './search-types.js';

export interface SearchProfileRepository {
  get(candidateId: string): Promise<CandidateSearchProfile | null>;
  save(profile: CandidateSearchProfile): Promise<void>;
}

export class SupabaseSearchProfileRepository implements SearchProfileRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async get(candidateId: string): Promise<CandidateSearchProfile | null> {
    const { data, error } = await this.client
      .from('candidate_search_profiles' as never)
      .select('profile_data')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    if (error) throw new Error('Could not load candidate search profile.');
    if (!data) return null;
    return (data as { profile_data: unknown }).profile_data as CandidateSearchProfile;
  }

  public async save(profile: CandidateSearchProfile): Promise<void> {
    const { error } = await this.client
      .from('candidate_search_profiles' as never)
      .upsert({
        candidate_id: profile.candidateId,
        profile_data: profile,
        generated_at: profile.generatedAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'candidate_id' });
    if (error) throw new Error('Could not save candidate search profile.');
  }
}
```

- [ ] **Step 5.4: Create search-profile.service.ts**

```typescript
// backend/src/search/search-profile.service.ts
import type { CandidateProfileDetail } from '../infrastructure/supabase/profile-repository.js';
import type { SearchProfileRepository } from './search-profile.repository.js';
import type { CandidateSearchProfile } from './search-types.js';

const PRIMARY_SKILL_LIMIT = 10;
const SECONDARY_SKILL_LIMIT = 10;

function deriveTargetRoles(headline: string | null): string[] {
  if (!headline) return [];
  const cleaned = headline.replace(/^(sebagai|as|seorang|a|an)\s+/i, '').trim();
  return cleaned ? [cleaned] : [];
}

export class SearchProfileService {
  public constructor(private readonly repository: SearchProfileRepository) {}

  public deriveFromProfile(
    profile: CandidateProfileDetail,
    candidateId: string
  ): CandidateSearchProfile {
    const allSkills = profile.skills.map(s => s.displayName);
    return {
      candidateId,
      targetRoles: deriveTargetRoles(profile.headline ?? null),
      roleAliases: [],
      primarySkills: allSkills.slice(0, PRIMARY_SKILL_LIMIT),
      secondarySkills: allSkills.slice(PRIMARY_SKILL_LIMIT, PRIMARY_SKILL_LIMIT + SECONDARY_SKILL_LIMIT),
      industries: [],
      seniority: [],
      preferredLocations: [],
      workModes: [],
      employmentTypes: ['full-time'],
      excludedRoles: [],
      excludedKeywords: [],
      excludedCompanies: [],
      languages: [],
      sources: ['jobstreet'],
      generatedAt: new Date().toISOString(),
    };
  }

  public async getOrDerive(
    candidateId: string,
    profile: CandidateProfileDetail
  ): Promise<CandidateSearchProfile> {
    const existing = await this.repository.get(candidateId);
    if (existing) return existing;
    const derived = this.deriveFromProfile(profile, candidateId);
    await this.repository.save(derived);
    return derived;
  }

  public async get(candidateId: string): Promise<CandidateSearchProfile | null> {
    return this.repository.get(candidateId);
  }

  public async save(profile: CandidateSearchProfile): Promise<void> {
    return this.repository.save(profile);
  }
}
```

- [ ] **Step 5.5: Run tests to verify they pass**

```
cd backend && bun test tests/unit/search/search-profile-service.test.ts
```
Expected: all pass

- [ ] **Step 5.6: Run full backend test suite**

```
cd backend && bun test
```
Expected: all existing tests still pass

- [ ] **Step 5.7: Commit**

```
git add backend/src/search/search-profile.repository.ts backend/src/search/search-profile.service.ts backend/tests/unit/search/search-profile-service.test.ts
git commit -m "feat(search): add search profile repository and derivation service"
```

---

## Task 6: API Route — GET /search-profile

**Files:**
- Modify: `backend/src/app.ts` — add `createSearchProfileService` to `AppDependencies` and route
- Modify: `backend/src/server.ts` — wire `SearchProfileService`

---

- [ ] **Step 6.1: Add to AppDependencies type in app.ts**

```typescript
// Add to AppDependencies (after createApplicationService):
createSearchProfileService?: (accessToken: string) => {
  get(candidateId: string): Promise<import('./search/search-types.js').CandidateSearchProfile | null>;
};
```

- [ ] **Step 6.2: Add route in app.ts after the /profile GET route**

```typescript
if (dependencies.createSearchProfileService) {
  router.get('/search-profile', authenticate, async (req, res, next) => {
    try {
      const svc = dependencies.createSearchProfileService!(res.locals.auth.accessToken);
      const profile = await svc.get(res.locals.auth.userId);
      if (!profile) return void res.status(404).json({ error: { code: 'SEARCH_PROFILE_NOT_FOUND', message: 'No search profile found. Upload a candidate profile to activate job discovery.' } });
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });
}
```

- [ ] **Step 6.3: Wire in server.ts**

Add imports:
```typescript
import { SearchProfileService } from './search/search-profile.service.js';
import { SupabaseSearchProfileRepository } from './search/search-profile.repository.js';
```

Add to `createApp` call:
```typescript
createSearchProfileService: (accessToken) => {
  const client = createUserSupabaseClient(accessToken, env);
  return new SearchProfileService(new SupabaseSearchProfileRepository(client));
},
```

- [ ] **Step 6.4: Run typecheck and all tests**

```
cd backend && bun run typecheck && bun test
```
Expected: exit code 0, all pass

- [ ] **Step 6.5: Commit**

```
git add backend/src/app.ts backend/src/server.ts
git commit -m "feat(api): add GET /api/search-profile endpoint"
```

---

## Task 7: Scheduler Refactor

**Files:**
- Modify: `backend/src/config/env.ts` — make `JOB_SCRAPE_SEARCHES_JSON` validation non-blocking when scheduler is enabled
- Modify: `backend/src/server.ts` — refactor scheduler tick to derive intents from search profile

---

- [ ] **Step 7.1: Relax env validation in env.ts**

```typescript
// Replace this line:
if (result.data.JOB_SCRAPE_ENABLED && (!result.data.CAMOUFOX_EXECUTABLE_PATH || result.data.JOB_SCRAPE_SEARCHES_JSON.length === 0)) {
  throw new Error('Invalid environment configuration: CAMOUFOX_EXECUTABLE_PATH and at least one JOB_SCRAPE_SEARCHES_JSON entry are required when JOB_SCRAPE_ENABLED=true.');
}

// With:
if (result.data.JOB_SCRAPE_ENABLED && !result.data.CAMOUFOX_EXECUTABLE_PATH) {
  throw new Error('Invalid environment configuration: CAMOUFOX_EXECUTABLE_PATH is required when JOB_SCRAPE_ENABLED=true.');
}
// JOB_SCRAPE_SEARCHES_JSON is optional — if empty, the search planner derives intents from candidate profile
```

- [ ] **Step 7.2: Update env test that checks for empty searches rejection**

In `backend/tests/unit/config/env.test.ts`, find the test that asserts `JOB_SCRAPE_SEARCHES_JSON` being empty causes an error when `JOB_SCRAPE_ENABLED=true`. Update that test expectation: an empty searches list is now valid (no error thrown for missing searches).

- [ ] **Step 7.3: Add imports in server.ts**

```typescript
import { SearchPlanner } from './search/search-planner.js';
import { SupabaseSearchProfileRepository } from './search/search-profile.repository.js';
import { SupabaseProfileRepository } from './infrastructure/supabase/profile-repository.js';
// SearchProfileService is already imported from step 6.3
```

- [ ] **Step 7.4: Refactor scheduler tick in server.ts**

Find the scheduler tick lambda and replace it:

```typescript
// NEW tick — candidate-driven, with hardcoded fallback:
async (id, _searches) => {
  if (env.jobScrapeEnabled) {
    try {
      const client = createUserSupabaseClient(accessToken, env);
      const searchSvc = new SearchProfileService(new SupabaseSearchProfileRepository(client));
      const profileRepo = new SupabaseProfileRepository(client);
      const planner = new SearchPlanner();

      let searchProfile = await searchSvc.get(id);
      if (!searchProfile) {
        const candidateProfile = await profileRepo.getActiveProfile(id);
        if (candidateProfile) {
          searchProfile = await searchSvc.getOrDerive(id, candidateProfile);
        }
      }

      const searches = searchProfile
        ? planner.createIntents(searchProfile, { defaultMaxPages: 5 })
        : env.scheduledJobSearches;

      for (const search of searches) {
        try { await scrapeTask.run(id, search); } catch {}
      }
    } catch {
      logger.error({ event: 'scheduler.plan.failed', candidateId: id, errorCode: 'SEARCH_PLAN_FAILED' });
    }
  }
  if (env.jobEmbeddingRecoveryEnabled) {
    try { await recovery.recover(id, env.jobEmbeddingRecoveryLimit); }
    catch { logger.error({ event: 'embedding.recovery.failed', candidateId: id, errorCode: 'RECOVERY_BATCH_FAILED' }); }
  }
}
```

- [ ] **Step 7.5: Run full test suite and typecheck**

```
cd backend && bun test && bun run typecheck
```
Expected: all pass

- [ ] **Step 7.6: Commit**

```
git add backend/src/config/env.ts backend/src/server.ts backend/tests/unit/config/env.test.ts
git commit -m "feat(scheduler): use candidate-driven search plans with hardcoded fallback"
```

---

## Task 8: Frontend — Types, Composable, and SearchProfileCard

**Files:**
- Create: `frontend/src/types/search-profile.ts`
- Create: `frontend/src/composables/useSearchProfile.ts`
- Create: `frontend/src/components/profile/SearchProfileCard.vue`
- Modify: `frontend/src/views/ProfileView.vue`

---

- [ ] **Step 8.1: Create frontend types**

```typescript
// frontend/src/types/search-profile.ts
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

export type CandidateSearchProfile = {
  candidateId: string;
  targetRoles: string[];
  roleAliases: string[];
  primarySkills: string[];
  secondarySkills: string[];
  industries: string[];
  experienceYears?: number;
  seniority: string[];
  preferredLocations: string[];
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
  excludedRoles: string[];
  excludedKeywords: string[];
  excludedCompanies: string[];
  languages: string[];
  salaryPreference?: { minimum?: number; currency?: string };
  sources: string[];
  generatedAt: string;
};
```

- [ ] **Step 8.2: Create useSearchProfile.ts composable**

```typescript
// frontend/src/composables/useSearchProfile.ts
import { ref } from 'vue';
import { apiClient } from '../lib/api';
import type { CandidateSearchProfile } from '../types/search-profile';

const searchProfile = ref<CandidateSearchProfile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

export function useSearchProfile() {
  async function fetchSearchProfile() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get<CandidateSearchProfile>('/search-profile');
      searchProfile.value = res;
    } catch (e: any) {
      if (e?.status === 404) {
        searchProfile.value = null;
      } else {
        error.value = e?.message || 'Failed to load search profile.';
      }
    } finally {
      loading.value = false;
    }
  }
  return { searchProfile, loading, error, fetchSearchProfile };
}
```

- [ ] **Step 8.3: Create SearchProfileCard.vue**

```vue
<!-- frontend/src/components/profile/SearchProfileCard.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { Search, MapPin, Briefcase, Monitor, Tag, ShieldOff, Database } from 'lucide-vue-next';
import { useSearchProfile } from '../../composables/useSearchProfile';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';
import SkillTag from '../common/SkillTag.vue';

const { searchProfile, loading, error, fetchSearchProfile } = useSearchProfile();
onMounted(() => { fetchSearchProfile(); });
</script>

<template>
  <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Search class="w-4 h-4 text-brand-700" />
          Active Job Search Profile
        </h3>
        <p class="text-xs text-stone-500 mt-0.5">What the agent is searching for on your behalf.</p>
      </div>
      <span v-if="searchProfile" class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">Active</span>
    </div>

    <LoadingSkeleton v-if="loading" />

    <div v-else-if="!searchProfile && !error" class="text-xs text-stone-500 py-2">
      No search profile generated yet. Upload a candidate profile to activate automated job discovery.
    </div>

    <div v-else-if="error" class="text-xs text-rose-600 py-2">{{ error }}</div>

    <div v-else-if="searchProfile" class="space-y-4">
      <div v-if="searchProfile.targetRoles.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Briefcase class="w-3 h-3" /> Target Roles
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="role in searchProfile.targetRoles" :key="role"
            class="px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200 text-[11px] font-semibold text-brand-800">
            {{ role }}
          </span>
        </div>
      </div>

      <div v-if="searchProfile.roleAliases.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Tag class="w-3 h-3" /> Search Terms
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="alias in searchProfile.roleAliases" :key="alias" :label="alias" />
        </div>
      </div>

      <div v-if="searchProfile.preferredLocations.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <MapPin class="w-3 h-3" /> Preferred Locations
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="loc in searchProfile.preferredLocations" :key="loc" :label="loc" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div v-if="searchProfile.workModes.length > 0">
          <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Monitor class="w-3 h-3" /> Work Mode
          </p>
          <div class="flex flex-wrap gap-1.5">
            <SkillTag v-for="mode in searchProfile.workModes" :key="mode" :label="mode" />
          </div>
        </div>
        <div v-if="searchProfile.employmentTypes.length > 0">
          <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Briefcase class="w-3 h-3" /> Employment
          </p>
          <div class="flex flex-wrap gap-1.5">
            <SkillTag v-for="type in searchProfile.employmentTypes" :key="type" :label="type" />
          </div>
        </div>
      </div>

      <div v-if="searchProfile.sources.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Database class="w-3 h-3" /> Active Sources
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="src in searchProfile.sources" :key="src" :label="src" />
        </div>
      </div>

      <div v-if="searchProfile.excludedRoles.length > 0 || searchProfile.excludedKeywords.length > 0 || searchProfile.excludedCompanies.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <ShieldOff class="w-3 h-3" /> Excluded
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="item in [...searchProfile.excludedRoles, ...searchProfile.excludedKeywords, ...searchProfile.excludedCompanies]" :key="item"
            class="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
            {{ item }}
          </span>
        </div>
      </div>

      <p class="text-[10px] text-stone-400 border-t border-surface-border pt-3">
        Generated {{ new Date(searchProfile.generatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }}
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 8.4: Add SearchProfileCard to ProfileView.vue**

Add import:
```typescript
import SearchProfileCard from '../components/profile/SearchProfileCard.vue';
```

After `<ProfileUploader @uploaded="fetchProfile" />`, add:
```vue
<!-- Search Profile Card -->
<SearchProfileCard />
```

- [ ] **Step 8.5: Run frontend typecheck and tests**

```
cd frontend && bun run typecheck && npm run test
```
Expected: typecheck clean, all 20 tests pass

- [ ] **Step 8.6: Commit**

```
git add frontend/src/types/search-profile.ts frontend/src/composables/useSearchProfile.ts frontend/src/components/profile/SearchProfileCard.vue frontend/src/views/ProfileView.vue
git commit -m "feat(frontend): add search profile card to profile view"
```

---

## Task 9: Final Verification and Documentation

**Files:**
- Create: `docs/architecture/search-agent.md`
- Modify: `AGENTS.md`

---

- [ ] **Step 9.1: Run complete verification**

```
cd d:\Work\tools\job-scrapper
npm run test && npm run typecheck && npm run build
```
Expected: all tests pass, typecheck clean, build succeeds

- [ ] **Step 9.2: Create architecture doc**

```markdown
<!-- docs/architecture/search-agent.md -->
# Personal Job Search Agent Architecture

The system is career-domain agnostic — it works for accounting, marketing, HR,
operations, tech, legal, education, hospitality, or any professional background.

## Flow

Candidate Markdown
    → Structured Candidate Profile (parser)
    → CandidateSearchProfile (SearchProfileService.deriveFromProfile)
    → JobSearchIntent[] (SearchPlanner.createIntents)
    → Scraper Adapters (Jobstreet; future: Glints, Loker.id)
    → Normalization + Deduplication
    → Eligibility Filter (applyHardFilters — hard rejects only)
    → Matching Engine (vector → rule scoring → LLM evaluation)
    → Recommendation

## Key Modules

- `src/search/search-types.ts` — shared types
- `src/search/role-alias-registry.ts` — deterministic alias expansion
- `src/search/query-expander.ts` — profile → keyword list
- `src/search/search-planner.ts` — keywords + locations → intents
- `src/search/eligibility-filter.ts` — hard reject before matching
- `src/search/search-profile.service.ts` — derive + persist + retrieve
- `src/search/search-profile.repository.ts` — Supabase persistence

## Design Decisions

- No LLM called inside the scheduler or scraper
- Search profile is persisted and reused, not regenerated every run
- Scraper adapters only discover; matching decides relevance
- Hard filters never reject on skill mismatch alone
- Alias registry is small and extensible, not a large taxonomy
- Hardcoded JOB_SCRAPE_SEARCHES_JSON is a fallback when no profile exists

## Future

- Frontend editor for search profile preferences
- Glints + Loker.id scraper adapters
- Application Policy for Assisted Apply
```

- [ ] **Step 9.3: Update AGENTS.md Implemented section**

Add to "Implemented":
- Candidate search profile model derived from candidate profile (no LLM on every run)
- Role alias registry and deterministic query expansion (career-domain agnostic)
- Search planner that generates `JobSearchIntent[]` for any professional background
- Hard-filter eligibility layer (does not reject on skill mismatch)
- Scheduler refactored to candidate-driven plans with hardcoded fallback
- `GET /api/search-profile` API endpoint
- Frontend `SearchProfileCard` (read-only transparency of agent search state)

Add to "Not yet implemented":
- Frontend editor for search profile preferences (locations, exclusions, sources)
- Glints and Loker.id scraper adapters
- Application Policy and Assisted Apply

- [ ] **Step 9.4: Final commit**

```
git add docs/architecture/search-agent.md AGENTS.md
git commit -m "docs: document personal job search agent architecture"
```

---

## Completion Criteria

- [ ] `CandidateSearchProfile` type defined and consistently used
- [ ] `SearchPlanner` works for tech, finance, marketing, ops candidates
- [ ] `expandRoleAliases` covers common Indonesian + English roles
- [ ] `applyHardFilters` rejects companies/expired/excluded roles; does NOT reject on missing skills
- [ ] `SearchProfileService.deriveFromProfile` works without LLM
- [ ] `SearchProfileService.getOrDerive` persists and reuses (no regeneration per tick)
- [ ] `GET /api/search-profile` returns 404 when no profile, 200 with data otherwise
- [ ] Scheduler uses candidate-driven plan with fallback to `env.scheduledJobSearches`
- [ ] `SearchProfileCard.vue` renders targetRoles, roleAliases, locations, workModes, sources, excluded
- [ ] All backend tests pass (`bun test`)
- [ ] All frontend tests pass (`npm run test`)
- [ ] Typecheck clean (`npm run typecheck`)
- [ ] Build passes (`npm run build`)
