import type { AiMatchAnalysis } from '../matching/llm-evaluator.js';
import type { CandidateMatchContext } from '../matching/context/candidate-match-context.js';
import type { JobMatchContext } from '../matching/context/job-match-context.js';
import type { CandidateScoringInput, JobScoringInput, RuleScore } from '../matching/scoring/types.js';
import type { VectorMatch } from '../matching/types.js';
import type { VectorSearchService } from '../matching/vector-search.service.js';
import type { MatchingRepository } from '../matching/matching.repository.js';
import type { LlmService } from '../ai/completion/llm.service.js';
import { scoreJob } from '../matching/scoring/scorer.js';
import { evaluateJobMatch } from '../matching/llm-evaluator.js';

export type MatchingRecommendation = VectorMatch & { ruleScore: number; breakdown: RuleScore['breakdown']; aiAnalysis: AiMatchAnalysis; recommendation: string };

export interface MatchingService {
  recommend(candidateId: string, limit: number, threshold: number, accessToken?: string): Promise<MatchingRecommendation[]>;
}

export class DefaultMatchingService implements MatchingService {
  public constructor(private readonly vectorSearch: Pick<VectorSearchService, 'search'>, private readonly repository: Pick<MatchingRepository, 'getCandidateContext' | 'getJobContext'>, private readonly llm: LlmService, private readonly chatModel: string) {}

  public async recommend(candidateId: string, limit: number, threshold: number): Promise<MatchingRecommendation[]> {
    const candidate = await this.repository.getCandidateContext(candidateId);
    const matches = await this.vectorSearch.search(candidateId, limit, threshold);
    const recommendations: MatchingRecommendation[] = [];
    for (const match of matches) {
      const job = await this.repository.getJobContext(candidateId, match.jobId);
      const ruleScore = scoreJob(candidate.scoring, job.scoring);
      const aiAnalysis = await evaluateJobMatch(
        this.llm,
        buildLegacyCandidateContext(candidate.scoring),
        buildLegacyJobContext(job.scoring, job.text),
        ruleScore,
        this.chatModel
      );
      recommendations.push({ ...match, ruleScore: ruleScore.total, breakdown: ruleScore.breakdown, aiAnalysis, recommendation: aiAnalysis.status === 'ready' ? aiAnalysis.recommendation : fallbackRecommendation(ruleScore.total) });
    }
    return recommendations;
  }
}

function fallbackRecommendation(score: number): string { return score >= 70 ? 'high_match' : score >= 45 ? 'medium_match' : 'low_match'; }

function buildLegacyCandidateContext(scoring: CandidateScoringInput): CandidateMatchContext {
  return {
    targetRoles: scoring.headline ? [compact(scoring.headline, 200)] : [],
    skills: scoring.skills.slice(0, 40),
    ...(scoring.experienceYears === undefined ? {} : { experienceYears: scoring.experienceYears }),
    seniority: [],
    industries: [],
    preferredLocations: scoring.preferences?.location ? [compact(scoring.preferences.location, 200)] : [],
    workModes: [],
    employmentTypes: [],
  };
}

function buildLegacyJobContext(scoring: JobScoringInput, text: string): JobMatchContext {
  return {
    title: compact(scoring.title, 200),
    company: '',
    requirements: '',
    responsibilities: compact(text, 1200),
    skills: scoring.skills.slice(0, 40),
    ...(scoring.location ? { location: compact(scoring.location, 200) } : {}),
    ...(scoring.workplaceType ? { workplaceType: compact(scoring.workplaceType, 200) } : {}),
  };
}

function compact(value: string, limit: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}
