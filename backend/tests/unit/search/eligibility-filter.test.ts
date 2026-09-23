import { describe, it, expect } from 'vitest';
import { applyHardFilters } from '../../../src/search/eligibility-filter.js';
import type { CandidateSearchProfile, HardFilterInput } from '../../../src/search/search-types.js';

const baseProfile: CandidateSearchProfile = {
  candidateId: 'test',
  targetRoles: ['Accountant'],
  roleAliases: [],
  primarySkills: ['Excel'],
  secondarySkills: [],
  industries: [],
  seniority: ['mid'],
  preferredLocations: ['Jakarta'],
  workModes: ['onsite'],
  employmentTypes: ['full-time'],
  excludedRoles: ['sales', 'internship'],
  excludedKeywords: ['MLM', 'network marketing'],
  excludedCompanies: ['BlockedCorp'],
  languages: [],
  sources: ['jobstreet'],
  generatedAt: '2026-01-01T00:00:00Z',
};

const validJob: HardFilterInput = {
  title: 'Accountant',
  companyName: 'Good Corp',
  employmentType: 'full-time',
  location: 'Jakarta',
};

describe('applyHardFilters', () => {
  it('allows a valid job', () => {
    expect(applyHardFilters(validJob, baseProfile)).toEqual({ eligible: true });
  });

  it('rejects a job from a blocked company', () => {
    const result = applyHardFilters({ ...validJob, companyName: 'BlockedCorp' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('company');
  });

  it('rejects a job with an excluded role keyword in title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Sales Executive' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('role');
  });

  it('rejects a job with excluded keyword in title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Distributor MLM Produk' }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('keyword');
  });

  it('rejects an expired job', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const result = applyHardFilters({ ...validJob, expiresAt: past }, baseProfile);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('expired');
  });

  it('does NOT reject a job because a skill is missing', () => {
    // Skill matching belongs in scoring, not hard filters
    const result = applyHardFilters({ ...validJob, title: 'Junior Accountant' }, baseProfile);
    expect(result.eligible).toBe(true);
  });

  it('does NOT reject a related but not identical title', () => {
    const result = applyHardFilters({ ...validJob, title: 'Finance & Accounting Officer' }, baseProfile);
    expect(result.eligible).toBe(true);
  });

  it('rejects internship when excluded', () => {
    const result = applyHardFilters({ ...validJob, title: 'Internship Accounting' }, baseProfile);
    expect(result.eligible).toBe(false);
  });
});
