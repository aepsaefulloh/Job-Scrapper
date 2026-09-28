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
    this.minVectorScore = options.minVectorScore ?? Number(process.env.AI_MATCH_MIN_VECTOR_SCORE || 0.6);
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
    const vectorSimMap = new Map<string, number>();
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
        preferredLocations: candidate.scoring.preferences?.location
          ? [candidate.scoring.preferences.location]
          : [],
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
