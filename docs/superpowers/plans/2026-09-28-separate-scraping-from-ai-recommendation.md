# Separate Scraping from AI Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple scraping completely from LLM calls by making scraping and pre-filtering 100% deterministic, bounding AI matching to top filtered jobs with rule/vector relevance gates and cache reusability, and exposing clean telemetry in Run Detail.

**Architecture:** 
1. Scraping and ingestion strictly handle HTML/DOM extraction, URL canonicalization, and deduplication without any LLM.
2. `PreLlmJobFilter` evaluates jobs deterministically against posting age, allowed sources, preferred locations, excluded roles, employment types, and active status.
3. Cheap relevance filter evaluates rule scores and vector embeddings, pruning low-relevance jobs and capping to `AI_MATCH_MAX_JOBS_PER_RUN`.
4. `EvaluationCacheRepository` checks `ai_match_evaluations` before calling SumoPod AI, skipping LLM on cache hit.
5. Telemetry updates `search_executions.summary` with deterministic vs AI metrics and surfaces them in `SearchRunDetailView.vue`.

**Tech Stack:** Node.js, TypeScript, Express, Supabase PostgreSQL, pgvector, SumoPod AI / Zod, Vue 3, Vite, Tailwind CSS, Bun test / Vitest.

## Global Constraints
- Scraping layer must remain 100% deterministic: 0 LLM imports or invocations in scrapers, normalizers, parsers, and deduplication.
- Pre-LLM filtering must reject expired, old, excluded, or out-of-preference jobs BEFORE any LLM evaluation.
- Configurable limits: `AI_MATCH_MAX_JOBS_PER_RUN` (default 20), `AI_MATCH_MIN_VECTOR_SCORE` (default 0.60), `AI_MATCH_MIN_RULE_SCORE` (default 60).
- Cache key identity: `candidate_id` + `profile_checksum` + `job_checksum` + `prompt_version` + `model`.
- AI recommendation categories: `strong_match` ("Strong Match"), `recommended` ("Recommended"), `potential_match` ("Potential Match"), `low_match` ("Low Match").
- Must work for technical and non-technical professional profiles alike.

---

### Task 1: Pre-LLM Deterministic Job Filter

**Files:**
- Create: `backend/src/search/pre-llm-job-filter.ts`
- Test: `backend/tests/search/pre-llm-job-filter.test.ts`

**Interfaces:**
- Consumes: `JobSearchPreferences` from `backend/src/search/preferences-types.ts`, `Job` / `NormalizedJob` or database record.
- Produces: `filterJobForLlm(job: FilterableJob, preferences?: JobSearchPreferences): { eligible: boolean; reason?: string }` and `filterJobsForLlm(jobs: FilterableJob[], preferences?: JobSearchPreferences): FilterableJob[]`.

- [ ] **Step 1: Write the failing test for `PreLlmJobFilter`**

Create `backend/tests/search/pre-llm-job-filter.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import { filterJobForLlm, filterJobsForLlm, type FilterableJob } from '../../src/search/pre-llm-job-filter.js';
import type { JobSearchPreferences } from '../../src/search/preferences-types.js';

describe('PreLlmJobFilter', () => {
  const baseJob: FilterableJob = {
    id: 'job-1',
    title: 'Senior Software Engineer',
    companyName: 'Tech Corp',
    source: 'jobstreet',
    status: 'active',
    location: 'Jakarta, Indonesia',
    employmentType: 'full-time',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  };

  const preferences: JobSearchPreferences = {
    maxPostingAgeDays: 14,
    sources: ['jobstreet'],
    locations: ['Jakarta', 'Remote'],
    excludedRoles: ['Manager', 'Director'],
    employmentTypes: ['full-time'],
    unknownPostingDatePolicy: 'allow',
  };

  it('accepts job matching all deterministic criteria', () => {
    const res = filterJobForLlm(baseJob, preferences);
    expect(res.eligible).toBe(true);
  });

  it('rejects expired or closed jobs', () => {
    const resExpired = filterJobForLlm({ ...baseJob, status: 'expired' }, preferences);
    expect(resExpired.eligible).toBe(false);
    expect(resExpired.reason).toBe('STATUS_NOT_ACTIVE');

    const resClosed = filterJobForLlm({ ...baseJob, status: 'closed' }, preferences);
    expect(resClosed.eligible).toBe(false);
    expect(resClosed.reason).toBe('STATUS_NOT_ACTIVE');
  });

  it('rejects jobs older than maxPostingAgeDays', () => {
    const oldJob: FilterableJob = {
      ...baseJob,
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    };
    const res = filterJobForLlm(oldJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('POSTING_TOO_OLD');
  });

  it('rejects jobs with excluded roles matching title case-insensitively', () => {
    const managerJob: FilterableJob = {
      ...baseJob,
      title: 'Engineering Manager',
    };
    const res = filterJobForLlm(managerJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('ROLE_EXCLUDED');
  });

  it('rejects jobs from unselected sources', () => {
    const linkedinJob: FilterableJob = {
      ...baseJob,
      source: 'linkedin',
    };
    const res = filterJobForLlm(linkedinJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('SOURCE_NOT_SELECTED');
  });

  it('rejects jobs outside preferred locations when locations are specified', () => {
    const baliJob: FilterableJob = {
      ...baseJob,
      location: 'Bali, Indonesia',
    };
    const res = filterJobForLlm(baliJob, preferences);
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('LOCATION_MISMATCH');
  });

  it('filters a batch of jobs returning only eligible ones', () => {
    const jobs: FilterableJob[] = [
      baseJob,
      { ...baseJob, id: 'job-2', title: 'Product Manager' },
      { ...baseJob, id: 'job-3', status: 'expired' },
      { ...baseJob, id: 'job-4', title: 'Backend Developer' },
    ];
    const eligible = filterJobsForLlm(jobs, preferences);
    expect(eligible.map((j) => j.id)).toEqual(['job-1', 'job-4']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/search/pre-llm-job-filter.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `PreLlmJobFilter`**

Create `backend/src/search/pre-llm-job-filter.ts`:
```typescript
import type { JobSearchPreferences } from './preferences-types.js';

export interface FilterableJob {
  id: string;
  title: string;
  companyName?: string;
  source: string;
  status: string;
  location?: string | null;
  employmentType?: string | null;
  publishedAt?: string | null;
  deletedAt?: string | null;
}

export interface FilterResult {
  eligible: boolean;
  reason?:
    | 'DELETED'
    | 'STATUS_NOT_ACTIVE'
    | 'POSTING_TOO_OLD'
    | 'SOURCE_NOT_SELECTED'
    | 'LOCATION_MISMATCH'
    | 'ROLE_EXCLUDED'
    | 'EMPLOYMENT_TYPE_MISMATCH';
}

export function filterJobForLlm(
  job: FilterableJob,
  preferences?: Partial<JobSearchPreferences>
): FilterResult {
  if (job.deletedAt) {
    return { eligible: false, reason: 'DELETED' };
  }

  if (job.status !== 'active') {
    return { eligible: false, reason: 'STATUS_NOT_ACTIVE' };
  }

  if (!preferences) {
    return { eligible: true };
  }

  // 1. Source check
  if (preferences.sources && preferences.sources.length > 0) {
    const jobSource = job.source.toLowerCase().trim();
    const sourceAllowed = preferences.sources.some(
      (s) => s.toLowerCase().trim() === jobSource
    );
    if (!sourceAllowed) {
      return { eligible: false, reason: 'SOURCE_NOT_SELECTED' };
    }
  }

  // 2. Excluded roles check
  if (preferences.excludedRoles && preferences.excludedRoles.length > 0) {
    const titleLower = job.title.toLowerCase();
    for (const excluded of preferences.excludedRoles) {
      const trimmed = excluded.trim().toLowerCase();
      if (trimmed && titleLower.includes(trimmed)) {
        return { eligible: false, reason: 'ROLE_EXCLUDED' };
      }
    }
  }

  // 3. Posting age check
  if (preferences.maxPostingAgeDays !== undefined && preferences.maxPostingAgeDays > 0) {
    if (job.publishedAt) {
      const published = new Date(job.publishedAt).getTime();
      if (!isNaN(published)) {
        const ageMs = Date.now() - published;
        const maxAgeMs = preferences.maxPostingAgeDays * 24 * 60 * 60 * 1000;
        if (ageMs > maxAgeMs) {
          return { eligible: false, reason: 'POSTING_TOO_OLD' };
        }
      }
    } else if (preferences.unknownPostingDatePolicy === 'reject') {
      return { eligible: false, reason: 'POSTING_TOO_OLD' };
    }
  }

  // 4. Preferred locations check
  if (preferences.locations && preferences.locations.length > 0) {
    if (!job.location) {
      // If candidate specified locations and job has no location, allow if remote is in locations
      const allowsRemote = preferences.locations.some((l) =>
        l.toLowerCase().includes('remote')
      );
      if (!allowsRemote) {
        return { eligible: false, reason: 'LOCATION_MISMATCH' };
      }
    } else {
      const jobLocLower = job.location.toLowerCase();
      const locationMatched = preferences.locations.some((loc) => {
        const lLower = loc.trim().toLowerCase();
        return lLower && (jobLocLower.includes(lLower) || lLower.includes(jobLocLower));
      });
      if (!locationMatched) {
        return { eligible: false, reason: 'LOCATION_MISMATCH' };
      }
    }
  }

  // 5. Employment type check
  if (preferences.employmentTypes && preferences.employmentTypes.length > 0 && job.employmentType) {
    const jobEmpLower = job.employmentType.toLowerCase().trim();
    const empMatched = preferences.employmentTypes.some((et) => {
      const eLower = et.toLowerCase().trim();
      return eLower && (jobEmpLower.includes(eLower) || eLower.includes(jobEmpLower));
    });
    if (!empMatched) {
      return { eligible: false, reason: 'EMPLOYMENT_TYPE_MISMATCH' };
    }
  }

  return { eligible: true };
}

export function filterJobsForLlm(
  jobs: FilterableJob[],
  preferences?: Partial<JobSearchPreferences>
): FilterableJob[] {
  return jobs.filter((job) => filterJobForLlm(job, preferences).eligible);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/search/pre-llm-job-filter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/search/pre-llm-job-filter.ts backend/tests/search/pre-llm-job-filter.test.ts
git commit -m "feat(matching): add deterministic pre-LLM job filter"
```

---

### Task 2: Update AI Match Evaluator Schema, Categories, and Domain-Agnostic Prompt

**Files:**
- Modify: `backend/src/matching/llm-evaluator.ts`
- Test: `backend/tests/matching/llm-evaluator.test.ts`

**Interfaces:**
- Consumes: `CandidateMatchContext`, `JobMatchContext`, `RuleScore`, `LlmService`.
- Produces: Updated schema supporting `'strong_match' | 'recommended' | 'potential_match' | 'low_match'`. Helper `formatRecommendationCategory(category: string): string`. Domain-agnostic evaluation system prompt.

- [ ] **Step 1: Write test for new categories and multi-domain compatibility**

Create/update `backend/tests/matching/llm-evaluator.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import {
  evaluateJobMatch,
  formatRecommendationCategory,
  conciseAiMatchSchema,
} from '../../src/matching/llm-evaluator.js';
import type { LlmService } from '../../src/ai/completion/llm.service.js';

describe('llm-evaluator schema and multi-domain evaluation', () => {
  it('validates recommendation category including recommended and low_match', () => {
    const valid = conciseAiMatchSchema.safeParse({
      score: 85,
      recommendation: 'recommended',
      strengths: ['Relevant experience in financial audits'],
      gaps: ['Missing CPA certificate'],
      summary: 'Strong accounting fit with direct industry experience.',
    });
    expect(valid.success).toBe(true);

    const validStrong = conciseAiMatchSchema.safeParse({
      score: 92,
      recommendation: 'strong_match',
      strengths: ['Operations leadership'],
      gaps: [],
      summary: 'Excellent operational leadership match.',
    });
    expect(validStrong.success).toBe(true);
  });

  it('formats category keys into product-facing labels', () => {
    expect(formatRecommendationCategory('strong_match')).toBe('Strong Match');
    expect(formatRecommendationCategory('recommended')).toBe('Recommended');
    expect(formatRecommendationCategory('potential_match')).toBe('Potential Match');
    expect(formatRecommendationCategory('low_match')).toBe('Low Match');
    expect(formatRecommendationCategory('unknown')).toBe('Potential Match');
  });

  it('evaluates non-technical profession (Accounting) correctly with LLM mock', async () => {
    const mockLlm: Pick<LlmService, 'completeJson'> = {
      async completeJson(_req, _schema) {
        return {
          score: 88,
          recommendation: 'recommended',
          strengths: ['5 years auditing experience', 'IFRS standards mastery'],
          gaps: ['ERP Oracle migration not mentioned'],
          summary: 'High suitability for Senior Auditor role.',
        } as any;
      },
    };

    const candidate = {
      targetRoles: ['Senior Auditor', 'Accounting Supervisor'],
      skills: ['IFRS', 'Financial Reporting', 'Tax Compliance'],
      experienceYears: 5,
      seniority: ['Senior'],
      industries: ['Finance'],
      preferredLocations: ['Jakarta'],
      workModes: ['On-site'],
      employmentTypes: ['full-time'],
    };

    const job = {
      title: 'Senior Financial Auditor',
      company: 'KAP Deloitte Indonesia',
      requirements: 'Min 4 years auditing experience with IFRS.',
      responsibilities: 'Lead audit engagements and prepare reports.',
      skills: ['IFRS', 'Auditing', 'Financial Statements'],
    };

    const ruleScore = {
      total: 80,
      breakdown: { titleMatch: 40, skillMatch: 40, locationMatch: 0, seniorityMatch: 0 },
      matchedSkills: ['IFRS'],
    };

    const result = await evaluateJobMatch(mockLlm, candidate, job, ruleScore);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.recommendation).toBe('recommended');
      expect(result.score).toBe(88);
      expect(result.strengths.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/matching/llm-evaluator.test.ts`
Expected: FAIL (categories missing or formatRecommendationCategory not defined)

- [ ] **Step 3: Update `backend/src/matching/llm-evaluator.ts`**

Update `backend/src/matching/llm-evaluator.ts`:
```typescript
import { z } from 'zod';
import type { LlmService } from '../ai/completion/llm.service.js';
import type { CandidateMatchContext } from './context/candidate-match-context.js';
import type { JobMatchContext } from './context/job-match-context.js';
import type { RuleScore } from './scoring/types.js';

export const AI_MATCH_PROMPT_VERSION = 'job-match-v3';

export const recommendationCategorySchema = z.enum([
  'strong_match',
  'recommended',
  'potential_match',
  'low_match',
]);

export type RecommendationCategory = z.infer<typeof recommendationCategorySchema>;

export function formatRecommendationCategory(category: string): string {
  switch (category) {
    case 'strong_match':
      return 'Strong Match';
    case 'recommended':
      return 'Recommended';
    case 'potential_match':
      return 'Potential Match';
    case 'low_match':
      return 'Low Match';
    default:
      return 'Potential Match';
  }
}

export const conciseAiMatchSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: recommendationCategorySchema,
  strengths: z.array(z.string().trim().min(1).max(160)).max(3),
  gaps: z.array(z.string().trim().min(1).max(160)).max(3),
  summary: z.string().trim().min(1).max(280),
}).strict();

export const readyAiMatchAnalysisSchema = conciseAiMatchSchema.extend({
  status: z.literal('ready'),
}).strict();

export type AiMatchAnalysis =
  | {
      status: 'ready';
      score: number;
      recommendation: RecommendationCategory;
      strengths: string[];
      gaps: string[];
      summary: string;
    }
  | { status: 'failed'; ruleScore: number; error: string };

export async function evaluateJobMatch(
  llm: Pick<LlmService, 'completeJson'>,
  candidate: CandidateMatchContext,
  job: JobMatchContext,
  ruleScore: RuleScore,
  model = 'configured'
): Promise<AiMatchAnalysis> {
  try {
    const analysis = await llm.completeJson(
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert career evaluation assistant. Objectively evaluate job compatibility based ONLY on the supplied candidate and job facts across any profession (technology, finance, accounting, healthcare, operations, marketing, legal, etc.). Return only concise JSON matching the schema. Do not invent facts.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              promptVersion: AI_MATCH_PROMPT_VERSION,
              candidate,
              job,
              ruleScore: {
                total: ruleScore.total,
                breakdown: ruleScore.breakdown,
                matchedSkills: ruleScore.matchedSkills.slice(0, 20),
              },
            }),
          },
        ],
      },
      conciseAiMatchSchema
    );
    return { status: 'ready', ...analysis };
  } catch {
    return { status: 'failed', ruleScore: ruleScore.total, error: 'AI evaluation failed.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/matching/llm-evaluator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/matching/llm-evaluator.ts backend/tests/matching/llm-evaluator.test.ts
git commit -m "feat(matching): update recommendation categories and domain-agnostic prompt"
```

---

### Task 3: Bounded AI Recommendation Pipeline with Cheap Relevance & Cache Integration

**Files:**
- Create: `backend/src/matching/recommendation-pipeline.ts`
- Test: `backend/tests/matching/recommendation-pipeline.test.ts`

**Interfaces:**
- Consumes: `PreLlmJobFilter`, `scoreJob`, `MatchingRepository`, `EvaluationCacheRepository`, `LlmService`.
- Produces: `RecommendationPipeline.evaluateJobs(...)` returning bounded recommendations, cache hit/miss counts, and metrics.

- [ ] **Step 1: Write test for recommendation pipeline with bounding and cache**

Create `backend/tests/matching/recommendation-pipeline.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import { RecommendationPipeline } from '../../src/matching/recommendation-pipeline.js';
import type { EvaluationCacheRepository, ReadyAiMatchAnalysis } from '../../src/matching/evaluation-cache.repository.js';
import type { MatchingRepository } from '../../src/matching/matching.repository.js';
import type { LlmService } from '../../src/ai/completion/llm.service.js';

describe('RecommendationPipeline', () => {
  const candidateId = 'cand-123';
  const profileChecksum = 'prof-sha256';

  const mockMatchingRepo: Pick<MatchingRepository, 'getCandidateContext' | 'getJobContext' | 'matchSubset' | 'getProfileEmbedding'> = {
    async getProfileEmbedding() { return [0.1, 0.2]; },
    async getCandidateContext() {
      return {
        text: 'Software Engineer TypeScript',
        scoring: { headline: 'Software Engineer', skills: ['typescript', 'node.js'] },
      };
    },
    async getJobContext(_candId, jobId) {
      return {
        text: `Job details for ${jobId}`,
        scoring: { title: `Software Engineer ${jobId}`, skills: ['typescript'] },
      };
    },
    async matchSubset(_candId, _emb, jobIds) {
      return jobIds.map((id, idx) => ({ job_id: id, similarity: 0.85 - idx * 0.1 }));
    },
  };

  it('bounds LLM evaluation count to maxJobsPerRun and skips low-score jobs', async () => {
    let llmCallCount = 0;
    const mockLlm: Pick<LlmService, 'completeJson'> = {
      async completeJson() {
        llmCallCount++;
        return {
          score: 80,
          recommendation: 'recommended',
          strengths: ['Skill match'],
          gaps: [],
          summary: 'Fit',
        } as any;
      },
    };

    const cacheMap = new Map<string, ReadyAiMatchAnalysis>();
    const mockCacheRepo: EvaluationCacheRepository = {
      async get(id) { return cacheMap.get(id.jobChecksum) ?? null; },
      async save(id, _jobId, evalData) { cacheMap.set(id.jobChecksum, evalData); },
    };

    const pipeline = new RecommendationPipeline(
      mockMatchingRepo as any,
      mockCacheRepo,
      mockLlm as any,
      {
        maxJobsPerRun: 2,
        minVectorScore: 0.60,
        minRuleScore: 20,
      }
    );

    const candidateJobs = [
      { id: 'j1', title: 'Software Engineer 1', source: 'jobstreet', status: 'active', checksum: 'chk-1' },
      { id: 'j2', title: 'Software Engineer 2', source: 'jobstreet', status: 'active', checksum: 'chk-2' },
      { id: 'j3', title: 'Software Engineer 3', source: 'jobstreet', status: 'active', checksum: 'chk-3' },
    ];

    const result = await pipeline.evaluateBatch({
      candidateId,
      profileChecksum,
      jobs: candidateJobs,
    });

    expect(result.metrics.jobsSentToLlm).toBe(2);
    expect(llmCallCount).toBe(2);
    expect(result.metrics.aiCacheMisses).toBe(2);
    expect(result.metrics.aiCacheHits).toBe(0);
    expect(result.recommendations.length).toBe(2);

    // Second run with same jobs should HIT cache without calling LLM
    const secondResult = await pipeline.evaluateBatch({
      candidateId,
      profileChecksum,
      jobs: candidateJobs,
    });

    expect(secondResult.metrics.aiCacheHits).toBe(2);
    expect(secondResult.metrics.aiCacheMisses).toBe(0);
    expect(llmCallCount).toBe(2); // didn't increase
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/matching/recommendation-pipeline.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `RecommendationPipeline`**

Create `backend/src/matching/recommendation-pipeline.ts`:
```typescript
import type { MatchingRepository } from './matching.repository.js';
import type { EvaluationCacheRepository, ReadyAiMatchAnalysis } from './evaluation-cache.repository.js';
import type { LlmService } from '../ai/completion/llm.service.js';
import { scoreJob } from './scoring/scorer.js';
import {
  evaluateJobMatch,
  AI_MATCH_PROMPT_VERSION,
  type RecommendationCategory,
} from './llm-evaluator.js';
import { filterJobsForLlm, type FilterableJob } from '../search/pre-llm-job-filter.js';
import type { JobSearchPreferences } from '../search/preferences-types.js';

export interface RecommendationPipelineOptions {
  maxJobsPerRun?: number;
  minVectorScore?: number;
  minRuleScore?: number;
  model?: string;
}

export interface CandidateJobInput extends FilterableJob {
  checksum?: string;
}

export interface RecommendationOutputItem {
  jobId: string;
  score: number;
  recommendation: RecommendationCategory;
  strengths: string[];
  gaps: string[];
  summary: string;
  source: 'cache' | 'ai';
  ruleScore: number;
  vectorSimilarity?: number;
}

export interface BatchEvaluationResult {
  recommendations: RecommendationOutputItem[];
  metrics: {
    scrapedOrDiscovered: number;
    afterDeterministicFilters: number;
    consideredForMatching: number;
    jobsSentToLlm: number;
    aiCacheHits: number;
    aiCacheMisses: number;
    recommendationsProduced: number;
  };
}

export class RecommendationPipeline {
  private readonly maxJobsPerRun: number;
  private readonly minVectorScore: number;
  private readonly minRuleScore: number;
  private readonly model: string;

  public constructor(
    private readonly matchingRepo: Pick<
      MatchingRepository,
      'getCandidateContext' | 'getJobContext' | 'matchSubset' | 'getProfileEmbedding'
    >,
    private readonly cacheRepo: EvaluationCacheRepository,
    private readonly llm: Pick<LlmService, 'completeJson'>,
    options: RecommendationPipelineOptions = {}
  ) {
    this.maxJobsPerRun = options.maxJobsPerRun ?? Number(process.env.AI_MATCH_MAX_JOBS_PER_RUN || 20);
    this.minVectorScore = options.minVectorScore ?? Number(process.env.AI_MATCH_MIN_VECTOR_SCORE || 0.60);
    this.minRuleScore = options.minRuleScore ?? Number(process.env.AI_MATCH_MIN_RULE_SCORE || 60);
    this.model = options.model ?? process.env.AI_CHAT_MODEL ?? 'configured';
  }

  public async evaluateBatch(input: {
    candidateId: string;
    profileChecksum: string;
    jobs: CandidateJobInput[];
    preferences?: Partial<JobSearchPreferences>;
  }): Promise<BatchEvaluationResult> {
    const { candidateId, profileChecksum, jobs, preferences } = input;
    const scrapedOrDiscovered = jobs.length;

    // 1. Deterministic pre-filter
    const filteredJobs = filterJobsForLlm(jobs, preferences);
    const afterDeterministicFilters = filteredJobs.length;

    if (afterDeterministicFilters === 0) {
      return {
        recommendations: [],
        metrics: {
          scrapedOrDiscovered,
          afterDeterministicFilters: 0,
          consideredForMatching: 0,
          jobsSentToLlm: 0,
          aiCacheHits: 0,
          aiCacheMisses: 0,
          recommendationsProduced: 0,
        },
      };
    }

    // 2. Load candidate context
    const candidate = await this.matchingRepo.getCandidateContext(candidateId);
    const profileEmbedding = await this.matchingRepo.getProfileEmbedding(candidateId);

    // 3. Cheap relevance filter (Rule score + Vector search)
    const jobScores: Array<{
      job: CandidateJobInput;
      ruleScore: number;
      ruleBreakdown: any;
      matchedSkills: string[];
      vectorSimilarity: number;
      combinedScore: number;
    }> = [];

    // Optional vector search subset
    let vectorSimMap = new Map<string, number>();
    if (profileEmbedding && filteredJobs.length > 0) {
      try {
        const subsetMatches = await this.matchingRepo.matchSubset(
          candidateId,
          profileEmbedding,
          filteredJobs.map((j) => j.id),
          filteredJobs.length,
          -1
        );
        for (const m of subsetMatches) {
          vectorSimMap.set(m.job_id, m.similarity);
        }
      } catch {
        // Fall back gracefully to rule score if vector search is unavailable
      }
    }

    for (const jobItem of filteredJobs) {
      const jobCtx = await this.matchingRepo.getJobContext(candidateId, jobItem.id);
      const scored = scoreJob(candidate.scoring, jobCtx.scoring);
      const similarity = vectorSimMap.get(jobItem.id) ?? 0;

      // Gate check: Pass if either rule score exceeds minRuleScore or vector similarity exceeds minVectorScore
      if (scored.total >= this.minRuleScore || similarity >= this.minVectorScore) {
        // Combined score weighted 60% vector (scaled to 100) + 40% rule
        const vector100 = Math.max(0, similarity) * 100;
        const combinedScore = similarity > 0 ? vector100 * 0.6 + scored.total * 0.4 : scored.total;

        jobScores.push({
          job: jobItem,
          ruleScore: scored.total,
          ruleBreakdown: scored.breakdown,
          matchedSkills: scored.matchedSkills,
          vectorSimilarity: similarity,
          combinedScore,
        });
      }
    }

    const consideredForMatching = jobScores.length;

    // Sort by combined score descending and slice up to maxJobsPerRun
    jobScores.sort((a, b) => b.combinedScore - a.combinedScore);
    const topJobs = jobScores.slice(0, this.maxJobsPerRun);

    const recommendations: RecommendationOutputItem[] = [];
    let aiCacheHits = 0;
    let aiCacheMisses = 0;
    let jobsSentToLlm = 0;

    for (const item of topJobs) {
      const jobChecksum = item.job.checksum || item.job.id;
      const cacheIdentity = {
        candidateId,
        profileChecksum,
        jobChecksum,
        promptVersion: AI_MATCH_PROMPT_VERSION,
        model: this.model,
      };

      // Check cache first
      const cached = await this.cacheRepo.get(cacheIdentity);
      if (cached) {
        aiCacheHits++;
        recommendations.push({
          jobId: item.job.id,
          score: cached.score,
          recommendation: cached.recommendation,
          strengths: cached.strengths,
          gaps: cached.gaps,
          summary: cached.summary,
          source: 'cache',
          ruleScore: item.ruleScore,
          vectorSimilarity: item.vectorSimilarity,
        });
        continue;
      }

      // Cache miss: invoke LLM
      jobsSentToLlm++;
      aiCacheMisses++;

      const jobCtx = await this.matchingRepo.getJobContext(candidateId, item.job.id);
      const candidateContext = {
        targetRoles: candidate.scoring.headline ? [candidate.scoring.headline] : [],
        skills: candidate.scoring.skills.slice(0, 40),
        seniority: [],
        industries: [],
        preferredLocations: candidate.scoring.preferences?.location ? [candidate.scoring.preferences.location] : [],
        workModes: [],
        employmentTypes: [],
      };
      const jobContext = {
        title: item.job.title,
        company: item.job.companyName ?? '',
        requirements: '',
        responsibilities: jobCtx.text.slice(0, 1200),
        skills: jobCtx.scoring.skills.slice(0, 40),
        location: item.job.location ?? undefined,
        workplaceType: undefined,
      };

      const aiAnalysis = await evaluateJobMatch(
        this.llm,
        candidateContext,
        jobContext,
        {
          total: item.ruleScore,
          breakdown: item.ruleBreakdown,
          matchedSkills: item.matchedSkills,
        },
        this.model
      );

      if (aiAnalysis.status === 'ready') {
        const readyEval: ReadyAiMatchAnalysis = {
          score: aiAnalysis.score,
          recommendation: aiAnalysis.recommendation,
          strengths: aiAnalysis.strengths,
          gaps: aiAnalysis.gaps,
          summary: aiAnalysis.summary,
        };

        // Save to cache asynchronously or await
        try {
          await this.cacheRepo.save(cacheIdentity, item.job.id, readyEval);
        } catch {
          // Non-blocking cache save error
        }

        recommendations.push({
          jobId: item.job.id,
          score: readyEval.score,
          recommendation: readyEval.recommendation,
          strengths: readyEval.strengths,
          gaps: readyEval.gaps,
          summary: readyEval.summary,
          source: 'ai',
          ruleScore: item.ruleScore,
          vectorSimilarity: item.vectorSimilarity,
        });
      }
    }

    return {
      recommendations,
      metrics: {
        scrapedOrDiscovered,
        afterDeterministicFilters,
        consideredForMatching,
        jobsSentToLlm,
        aiCacheHits,
        aiCacheMisses,
        recommendationsProduced: recommendations.length,
      },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/matching/recommendation-pipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/matching/recommendation-pipeline.ts backend/tests/matching/recommendation-pipeline.test.ts
git commit -m "feat(matching): implement bounded recommendation pipeline with cheap relevance and cache"
```

---

### Task 4: Connect Pipeline to CandidateSearchService and Search Execution Repository

**Files:**
- Modify: `backend/src/search/search-execution.repository.ts`
- Modify: `backend/src/search/candidate-search.service.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/search/candidate-search.service.test.ts`

**Interfaces:**
- Consumes: `RecommendationPipeline` injected into `CandidateSearchService`.
- Produces: Live stages, timeline events, and detailed telemetry metrics (`afterDeterministicFilters`, `consideredForMatching`, `sentToLlm`, `aiCacheHits`, `aiCacheMisses`, `recommendationsProduced`) saved into `search_executions.summary`.

- [ ] **Step 1: Update `SearchExecutionSummary` interface**

In `backend/src/search/search-execution.repository.ts`, update `SearchExecutionSummary`:
```typescript
export interface SearchExecutionSummary {
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  filteredOut: number;
  afterDeterministicFilters?: number;
  consideredForMatching?: number;
  sentToLlm?: number;
  aiCacheHits?: number;
  aiCacheMisses?: number;
  recommendationsProduced?: number;
  aiEvaluated: number;
  aiFailed: number;
}
```

- [ ] **Step 2: Update `CandidateSearchService` to execute recommendation pipeline**

In `backend/src/search/candidate-search.service.ts`:
- Inject optional `recommendationPipeline?: RecommendationPipeline`.
- In `executeRuns`, after child scraping runs complete:
  - If `recommendationPipeline` is provided and newly inserted/updated jobs exist (or active candidate jobs):
    - Update stage `stage:norm` with completed.
    - Update stage `stage:fresh` with completed and details showing count of passed deterministic filters.
    - Update stage `stage:ai_matching` to running with details.
    - Execute `recommendationPipeline.evaluateBatch(...)`.
    - Update stage `stage:ai_matching` to completed with details: e.g. `${metrics.recommendationsProduced} recommendations (${metrics.aiCacheHits} cached, ${metrics.aiCacheMisses} evaluated)`.
    - Save detailed summary metrics to `searchExecutionRepo.finish(...)`.

- [ ] **Step 3: Wire `RecommendationPipeline` in `backend/src/server.ts`**

Update the composition root in `backend/src/server.ts` to instantiate `RecommendationPipeline` with `matchingRepo`, `evaluationCacheRepo`, and `llmService`, then pass it to `createCandidateSearchService`.

- [ ] **Step 4: Run backend tests**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/search/search-execution.repository.ts backend/src/search/candidate-search.service.ts backend/src/server.ts
git commit -m "feat(search): connect recommendation pipeline to search execution telemetry"
```

---

### Task 5: Frontend Run Detail Telemetry & AI Visibility Update

**Files:**
- Modify: `frontend/src/views/SearchRunDetailView.vue`
- Test: `frontend/src/views/__tests__/SearchRunDetailView.spec.ts` (if existing) or frontend component test

**Interfaces:**
- Consumes: `execution.summary` fields (`afterDeterministicFilters`, `consideredForMatching`, `sentToLlm`, `aiCacheHits`, `aiCacheMisses`, `recommendationsProduced`).
- Produces: Clear visual separation showing Scraping/Ingestion (0 AI) and AI Recommendation stage with cache stats.

- [ ] **Step 1: Update Summary Cards in `SearchRunDetailView.vue`**

Display additional safe metric cards in `SearchRunDetailView.vue`:
1. `Deterministic Filters Passed`
2. `Top Evaluated by AI` (with `✦ AI` badge)
3. `Cache Hits (0 Tokens)`
4. `Recommendations Ready`

Ensure copy explicitly reinforces:
- "Scraping & Ingestion: 100% Deterministic (Zero LLM)"
- "AI Recommendation: Bounded to Top Relevant Jobs with Exact Cache"

- [ ] **Step 2: Run frontend tests & typecheck**

Run:
```powershell
cd frontend
bun run typecheck
bun test
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/SearchRunDetailView.vue
git commit -m "feat(ui): display deterministic vs AI telemetry metrics in run detail"
```

---

### Task 6: Comprehensive Verification Across Repositories

**Files:**
- Test: `backend/tests/scraping/zero-llm-scraper.test.ts`
- Verification commands across `backend` and `frontend`.

- [ ] **Step 1: Write explicit Zero-LLM Scraper test**

Create `backend/tests/scraping/zero-llm-scraper.test.ts`:
Verify that `JobstreetBrowserAdapter` and `RawJobInput` normalizer contain no LLM dependencies, imports, or mocks, proving scraper purity.

- [ ] **Step 2: Run full verification suite**

Run:
```powershell
# In root / backend
bun test
bun run typecheck
bun run build

# In frontend
cd frontend
bun run typecheck
bun run build
```
Expected: All checks PASS with 0 errors.

- [ ] **Step 3: Commit final milestone deliverables**

```bash
git add .
git commit -m "chore: complete separate scraping from AI recommendation milestone"
```
