import type { AiMatchAnalysis } from '../matching/llm-evaluator.js';
import type { RuleScore } from '../matching/scoring/types.js';
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
      const aiAnalysis = await evaluateJobMatch(this.llm, candidate.text, job.text, ruleScore, this.chatModel);
      recommendations.push({ ...match, ruleScore: ruleScore.total, breakdown: ruleScore.breakdown, aiAnalysis, recommendation: aiAnalysis.status === 'ready' ? aiAnalysis.recommendation : fallbackRecommendation(ruleScore.total) });
    }
    return recommendations;
  }
}

function fallbackRecommendation(score: number): string { return score >= 70 ? 'high_match' : score >= 45 ? 'medium_match' : 'low_match'; }
