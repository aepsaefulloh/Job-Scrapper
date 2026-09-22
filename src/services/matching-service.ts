import type { AiMatchAnalysis } from '../matching/llm-evaluator.js';
import type { RuleScore } from '../matching/scoring/types.js';
import type { VectorMatch } from '../matching/types.js';

export type MatchingRecommendation = VectorMatch & { ruleScore: number; breakdown: RuleScore['breakdown']; aiAnalysis: AiMatchAnalysis; recommendation: string };

export interface MatchingService {
  recommend(candidateId: string, limit: number, threshold: number, accessToken?: string): Promise<MatchingRecommendation[]>;
}
