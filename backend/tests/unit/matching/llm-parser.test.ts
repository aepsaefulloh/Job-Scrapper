import { describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { evaluateJobMatch } from '../../../src/matching/llm-evaluator.js';
import type { CandidateMatchContext } from '../../../src/matching/context/candidate-match-context.js';
import type { JobMatchContext } from '../../../src/matching/context/job-match-context.js';
import type { RuleScore } from '../../../src/matching/scoring/types.js';

const candidateContext: CandidateMatchContext = {
  targetRoles: ['Backend Engineer'],
  skills: ['typescript', 'postgresql'],
  experienceYears: 4,
  seniority: ['mid'],
  industries: ['fintech'],
  preferredLocations: ['Jakarta'],
  workModes: ['hybrid'],
  employmentTypes: ['full-time'],
};

const jobContext: JobMatchContext = {
  title: 'Backend Engineer',
  company: 'Acme',
  requirements: 'TypeScript and PostgreSQL.',
  responsibilities: 'Build reliable APIs.',
  skills: ['typescript', 'postgresql'],
  experienceRequirement: '3 years experience.',
  location: 'Jakarta',
  employmentType: 'full-time',
  workplaceType: 'hybrid',
};

const ruleScore: RuleScore = {
  total: 80,
  breakdown: { skills: 40, experience: 20, role: 10, preference: 10, careerPreference: 0 },
  matchedSkills: ['typescript', 'postgresql'],
  missingSkills: [],
};

describe('LLM match evaluator', () => {
  it('returns concise structured analysis and sends compact JSON context', async () => {
    const completeJson = vi.fn().mockResolvedValue({
      score: 82,
      recommendation: 'strong_match',
      strengths: ['Strong TypeScript'],
      gaps: ['No AWS evidence'],
      summary: 'Good fit for the core backend responsibilities.',
    });

    await expect(
      evaluateJobMatch(
        { completeJson } as never,
        candidateContext,
        jobContext,
        ruleScore,
        'model-x'
      )
    ).resolves.toMatchObject({
      status: 'ready',
      score: 82,
      recommendation: 'strong_match',
      gaps: ['No AWS evidence'],
    });

    expect(completeJson).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'model-x' }),
      expect.anything()
    );
    const request = completeJson.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    const payload = JSON.parse(request.messages[1]!.content) as Record<string, unknown>;
    expect(payload).toMatchObject({
      promptVersion: 'job-match-v2',
      candidate: candidateContext,
      job: jobContext,
      ruleScore: { total: 80 },
    });
    expect(JSON.stringify(payload)).not.toContain('missingSkills');
  });

  it.each([
    ['four strengths', { score: 82, recommendation: 'strong_match', strengths: ['1', '2', '3', '4'], gaps: [], summary: 'Fit.' }],
    ['four gaps', { score: 82, recommendation: 'strong_match', strengths: [], gaps: ['1', '2', '3', '4'], summary: 'Fit.' }],
    ['long summary', { score: 82, recommendation: 'strong_match', strengths: [], gaps: [], summary: 'x'.repeat(281) }],
    ['unknown key', { score: 82, recommendation: 'strong_match', strengths: [], gaps: [], summary: 'Fit.', details: 'extra' }],
    ['invalid recommendation', { score: 82, recommendation: 'high_match', strengths: [], gaps: [], summary: 'Fit.' }],
  ])('maps invalid %s output to a safe failure', async (_label, response) => {
    const completeJson = vi.fn().mockImplementation(
      async (_request: unknown, schema: ZodType) => schema.parse(response)
    );

    await expect(
      evaluateJobMatch({ completeJson } as never, candidateContext, jobContext, ruleScore)
    ).resolves.toEqual({ status: 'failed', ruleScore: 80, error: 'AI evaluation failed.' });
  });

  it('returns a typed failure while preserving deterministic score', async () => {
    const completeJson = vi.fn().mockRejectedValue(new Error('provider unavailable'));

    await expect(
      evaluateJobMatch({ completeJson } as never, candidateContext, jobContext, ruleScore)
    ).resolves.toMatchObject({ status: 'failed', ruleScore: 80 });
  });
});
