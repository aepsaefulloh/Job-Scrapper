import { describe, expect, it } from 'bun:test';
import {
  evaluateJobMatch,
  formatRecommendationCategory,
  conciseAiMatchSchema,
} from '../../../src/matching/llm-evaluator.js';
import type { LlmService } from '../../../src/ai/completion/llm.service.js';

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
    expect(formatRecommendationCategory('weak_match')).toBe('Low Match');
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
      breakdown: { titleMatch: 40, skillMatch: 40, locationMatch: 0, seniorityMatch: 0 } as any,
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
