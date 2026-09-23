import { describe, expect, it } from 'vitest';
import { SearchPlanner } from '../../../src/search/search-planner.js';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

describe('Career-Domain Agnostic Search Planning for Loker.id and Jobstreet', () => {
  const planner = new SearchPlanner();

  const domains: Array<{
    name: string;
    profile: CandidateSearchProfile;
    expectedKeywordParts: string[];
  }> = [
    {
      name: 'Accounting / Finance',
      profile: {
        candidateId: 'cand-acc',
        sourceProfileId: 'prof-acc',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Accountant', 'Tax Specialist'],
        roleAliases: ['Accounting Staff', 'Staf Akuntansi'],
        primarySkills: ['Taxation', 'Financial Reporting', 'Brevet A/B'],
        secondarySkills: ['Accurate', 'Excel'],
        industries: [],
        seniority: [],
        preferredLocations: ['Jakarta'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      },
      expectedKeywordParts: ['accountant', 'tax specialist'],
    },
    {
      name: 'Marketing',
      profile: {
        candidateId: 'cand-mkt',
        sourceProfileId: 'prof-mkt',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Digital Marketing Specialist'],
        roleAliases: ['Social Media Strategist'],
        primarySkills: ['SEO', 'Google Ads', 'Content Strategy'],
        secondarySkills: ['Copywriting'],
        industries: [],
        seniority: [],
        preferredLocations: ['Bandung'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      },
      expectedKeywordParts: ['digital marketing specialist'],
    },
    {
      name: 'HR',
      profile: {
        candidateId: 'cand-hr',
        sourceProfileId: 'prof-hr',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['HR Generalist', 'Recruitment Specialist'],
        roleAliases: ['Talent Acquisition Specialist'],
        primarySkills: ['Interviewing', 'Employee Relations', 'Payroll'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: ['Surabaya'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      },
      expectedKeywordParts: ['hr generalist', 'recruitment specialist'],
    },
    {
      name: 'Operations',
      profile: {
        candidateId: 'cand-ops',
        sourceProfileId: 'prof-ops',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Supply Chain Manager', 'Operations Lead'],
        roleAliases: ['Logistics Supervisor'],
        primarySkills: ['Inventory Management', 'Procurement', 'Warehouse Operations'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: ['Bekasi'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      },
      expectedKeywordParts: ['supply chain manager', 'operations lead'],
    },
    {
      name: 'Software / IT',
      profile: {
        candidateId: 'cand-it',
        sourceProfileId: 'prof-it',
        sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
        targetRoles: ['Full Stack Engineer'],
        roleAliases: ['Backend Developer'],
        primarySkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
        secondarySkills: ['Vue.js', 'Docker'],
        industries: [],
        seniority: [],
        preferredLocations: ['Jakarta'],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet', 'loker-id'],
        generatedAt: '2026-01-01T00:00:00Z',
      },
      expectedKeywordParts: ['full stack engineer'],
    },
  ];

  for (const { name, profile, expectedKeywordParts } of domains) {
    it(`generates balanced search intents for ${name} across Jobstreet and Loker.id`, () => {
      const intents = planner.createIntents(profile, { defaultMaxPages: 1 });

      expect(intents.length).toBeGreaterThan(0);

      const jobstreetIntents = intents.filter((i) => i.source === 'jobstreet');
      const lokerIdIntents = intents.filter((i) => i.source === 'loker-id');

      expect(jobstreetIntents.length).toBeGreaterThan(0);
      expect(lokerIdIntents.length).toBeGreaterThan(0);

      // Verify keywords reflect the candidate's actual profession
      for (const expected of expectedKeywordParts) {
        const foundInLoker = lokerIdIntents.some((i) => i.keyword.toLowerCase().includes(expected));
        expect(foundInLoker).toBe(true);
      }
    });
  }
});
