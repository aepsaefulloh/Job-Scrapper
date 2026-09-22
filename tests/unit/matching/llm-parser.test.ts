import { describe, expect, it, vi } from 'vitest';
import { evaluateJobMatch } from '../../../src/matching/llm-evaluator.js';

describe('LLM match evaluator', () => {
  it('returns structured analysis from the completion service', async () => {
    const completeJson = vi.fn().mockResolvedValue({ match_score: 90, strengths: ['TypeScript'], missing_skills: [], recommendation: 'high_match' });
    await expect(evaluateJobMatch({ completeJson } as never, 'profile', 'job', { total: 80, breakdown: { skills: 40, experience: 20, role: 10, preference: 10, careerPreference: 0 }, matchedSkills: [], missingSkills: [] })).resolves.toMatchObject({ matchScore: 90 });
  });

  it('returns a typed failure while preserving deterministic score', async () => {
    const completeJson = vi.fn().mockRejectedValue(new Error('invalid'));
    await expect(evaluateJobMatch({ completeJson } as never, 'profile', 'job', { total: 80, breakdown: { skills: 40, experience: 20, role: 10, preference: 10, careerPreference: 0 }, matchedSkills: [], missingSkills: [] })).resolves.toMatchObject({ status: 'failed', ruleScore: 80 });
  });
});
