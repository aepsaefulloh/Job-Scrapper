import { z } from 'zod';
import type { LlmService } from '../ai/completion/llm.service.js';
import type { RuleScore } from './scoring/types.js';

const analysisSchema = z.object({ match_score: z.number().min(0).max(100), strengths: z.array(z.string()), missing_skills: z.array(z.string()), recommendation: z.enum(['high_match', 'medium_match', 'low_match']) });
export type AiMatchAnalysis = { status: 'ready'; matchScore: number; strengths: string[]; missingSkills: string[]; recommendation: string } | { status: 'failed'; ruleScore: number; error: string };

export async function evaluateJobMatch(llm: Pick<LlmService, 'completeJson'>, profileText: string, jobText: string, ruleScore: RuleScore): Promise<AiMatchAnalysis> {
  try {
    const analysis = await llm.completeJson({ model: 'configured', messages: [{ role: 'system', content: 'Evaluate job compatibility and return only JSON.' }, { role: 'user', content: JSON.stringify({ profile: profileText, job: jobText, ruleScore }) }] }, analysisSchema);
    return { status: 'ready', matchScore: analysis.match_score, strengths: analysis.strengths, missingSkills: analysis.missing_skills, recommendation: analysis.recommendation };
  } catch {
    return { status: 'failed', ruleScore: ruleScore.total, error: 'AI evaluation failed.' };
  }
}
