import { describe, expect, it } from 'vitest';
import { scoreJob } from '../../../src/matching/scoring/scorer.js';

describe('rule scorer', () => {
  it('returns the default weighted breakdown and missing skills', () => {
    const score = scoreJob({ skills: ['typescript', 'sql'], headline: 'Backend Engineer', experienceYears: 3, preferences: { location: 'remote' } }, { skills: ['typescript', 'python'], title: 'Backend Engineer', experienceYears: 3, workplaceType: 'remote' });
    expect(score.breakdown).toEqual({ skills: 20, experience: 20, role: 15, preference: 15 });
    expect(score.total).toBe(70);
    expect(score.missingSkills).toEqual(['python']);
  });

  it('supports custom weights and clamps totals', () => {
    const score = scoreJob({ skills: ['typescript'], headline: 'Engineer' }, { skills: ['typescript'], title: 'Engineer' }, { skills: 100, experience: 0, role: 100, preference: 0 });
    expect(score.total).toBe(100);
  });
});
