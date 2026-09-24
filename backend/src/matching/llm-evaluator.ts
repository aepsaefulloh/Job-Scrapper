import { z } from 'zod';
import type { LlmService } from '../ai/completion/llm.service.js';
import type { CandidateMatchContext } from './context/candidate-match-context.js';
import type { JobMatchContext } from './context/job-match-context.js';
import type { RuleScore } from './scoring/types.js';

export const AI_MATCH_PROMPT_VERSION = 'job-match-v2';

export const conciseAiMatchSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(['strong_match', 'potential_match', 'weak_match']),
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
      recommendation: 'strong_match' | 'potential_match' | 'weak_match';
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
            content: 'Evaluate job compatibility from the supplied structured facts. Return only the requested concise JSON and do not invent evidence.',
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
