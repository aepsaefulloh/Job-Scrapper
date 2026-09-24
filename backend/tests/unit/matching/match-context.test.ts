import { describe, expect, it } from 'vitest';
import { buildCandidateMatchContext } from '../../../src/matching/context/candidate-match-context.js';
import { buildJobMatchContext } from '../../../src/matching/context/job-match-context.js';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

const searchProfile: CandidateSearchProfile = {
  candidateId: 'candidate-1',
  sourceProfileId: 'profile-1',
  sourceProfileUpdatedAt: '2026-09-24T00:00:00.000Z',
  targetRoles: ['Backend Engineer'],
  roleAliases: ['API Engineer'],
  primarySkills: ['typescript'],
  secondarySkills: ['postgresql'],
  industries: ['fintech'],
  experienceYears: 4,
  seniority: ['mid'],
  preferredLocations: ['Jakarta'],
  workModes: ['hybrid'],
  employmentTypes: ['full-time'],
  excludedRoles: ['Sales'],
  excludedKeywords: ['commission'],
  excludedCompanies: ['Blocked Corp'],
  languages: ['English'],
  salaryPreference: { minimum: 20_000_000, currency: 'IDR' },
  sources: ['jobstreet'],
  generatedAt: '2026-09-24T00:00:00.000Z',
};

describe('compact matching contexts', () => {
  it('emits only candidate fields relevant to matching', () => {
    const candidate = buildCandidateMatchContext(searchProfile);

    expect(candidate).toEqual({
      targetRoles: ['Backend Engineer'],
      skills: ['typescript', 'postgresql'],
      experienceYears: 4,
      seniority: ['mid'],
      industries: ['fintech'],
      preferredLocations: ['Jakarta'],
      workModes: ['hybrid'],
      employmentTypes: ['full-time'],
    });
    expect(JSON.stringify(candidate)).not.toContain('excludedCompanies');
    expect(JSON.stringify(candidate)).not.toContain('candidate-1');
  });

  it('extracts bounded structured job sections without raw markup', () => {
    const job = buildJobMatchContext(
      {
        title: 'Backend Engineer',
        companyName: 'Acme',
        description: '<html>Responsibilities:\nBuild APIs.\nRequirements:\nTypeScript and 3 years experience.\n</html>'.repeat(100),
        location: 'Jakarta',
        employmentType: 'full-time',
        workplaceType: 'hybrid',
      },
      [{ displayName: 'TypeScript', canonicalName: 'typescript', matchMethod: 'keyword' }]
    );

    expect(job.requirements.length).toBeLessThanOrEqual(1200);
    expect(job.responsibilities.length).toBeLessThanOrEqual(1200);
    expect(job.requirements).toContain('TypeScript');
    expect(job.responsibilities).toContain('Build APIs');
    expect(job.experienceRequirement).toContain('3 years');
    expect(job.skills).toEqual(['typescript']);
    expect(JSON.stringify(job)).not.toContain('<html');
  });

  it('uses bounded responsibilities when no section heading is recognized', () => {
    const job = buildJobMatchContext(
      {
        title: 'Engineer',
        companyName: 'Acme',
        description: 'Build reliable services and collaborate with the product team. '.repeat(100),
      },
      []
    );

    expect(job.requirements).toBe('');
    expect(job.responsibilities.length).toBeLessThanOrEqual(1200);
    expect(job.responsibilities).toContain('Build reliable services');
  });
});
