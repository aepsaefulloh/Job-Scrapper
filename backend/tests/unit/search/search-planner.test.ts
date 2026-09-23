import { describe, it, expect } from 'vitest';
import { SearchPlanner } from '../../../src/search/search-planner.js';
import techProfile from '../../fixtures/search-profile-tech.json';
import financeProfile from '../../fixtures/search-profile-finance.json';
import marketingProfile from '../../fixtures/search-profile-marketing.json';
import opsProfile from '../../fixtures/search-profile-ops.json';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

describe('SearchPlanner', () => {
  const planner = new SearchPlanner();

  it('creates intents for tech candidate', () => {
    const intents = planner.createIntents(techProfile as CandidateSearchProfile);
    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(typeof intent.keyword).toBe('string');
      expect(intent.keyword.length).toBeGreaterThan(0);
      expect(typeof intent.source).toBe('string');
    }
  });

  it('creates intents for finance (non-technical) candidate', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('accountant'))).toBe(true);
  });

  it('creates intents for marketing candidate with multiple roles', () => {
    const intents = planner.createIntents(marketingProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('marketing'))).toBe(true);
    expect(keywords.some(k => k.includes('content') || k.includes('copywriter'))).toBe(true);
  });

  it('creates intents for ops candidate (non-technical)', () => {
    const intents = planner.createIntents(opsProfile as CandidateSearchProfile);
    const keywords = intents.map(i => i.keyword);
    expect(keywords.some(k => k.includes('admin') || k.includes('operations'))).toBe(true);
  });

  it('respects maxIntentsPerRole option', () => {
    const intents = planner.createIntents(marketingProfile as CandidateSearchProfile, { maxIntentsPerRole: 2 });
    // 2 roles * 2 max * 2 locations = 8 max
    expect(intents.length).toBeLessThanOrEqual(8);
  });

  it('attaches location to intents when profile has preferredLocations', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile);
    const withJakarta = intents.filter(i => i.location === 'Jakarta');
    expect(withJakarta.length).toBeGreaterThan(0);
  });

  it('applies defaultMaxPages option', () => {
    const intents = planner.createIntents(financeProfile as CandidateSearchProfile, { defaultMaxPages: 3 });
    for (const intent of intents) {
      expect(intent.maxPages).toBe(3);
    }
  });

  it('uses only sources from profile', () => {
    const intents = planner.createIntents(techProfile as CandidateSearchProfile);
    for (const intent of intents) {
      expect((techProfile as CandidateSearchProfile).sources).toContain(intent.source);
    }
  });

  it('generates identical search intents across multiple sources (Jobstreet and Glints)', () => {
    const multiSourceProfile: CandidateSearchProfile = {
      ...(financeProfile as CandidateSearchProfile),
      sources: ['jobstreet', 'glints'],
    };

    const intents = planner.createIntents(multiSourceProfile);
    const jobstreetIntents = intents.filter((i) => i.source === 'jobstreet');
    const glintsIntents = intents.filter((i) => i.source === 'glints');

    expect(jobstreetIntents.length).toBeGreaterThan(0);
    expect(glintsIntents.length).toBe(jobstreetIntents.length);

    // Each jobstreet intent has an identical glints counterpart with the same keyword and location
    for (let index = 0; index < jobstreetIntents.length; index++) {
      expect(glintsIntents[index].keyword).toBe(jobstreetIntents[index].keyword);
      expect(glintsIntents[index].location).toBe(jobstreetIntents[index].location);
    }
  });

  it('keeps source selection independent of candidate role or domain', () => {
    const domains = [techProfile, financeProfile, marketingProfile, opsProfile];
    for (const domain of domains) {
      const customSourcesProfile: CandidateSearchProfile = {
        ...(domain as CandidateSearchProfile),
        sources: ['glints', 'jobstreet'],
      };
      const intents = planner.createIntents(customSourcesProfile);
      const sourcesUsed = new Set(intents.map((i) => i.source));
      expect(sourcesUsed).toEqual(new Set(['glints', 'jobstreet']));
    }
  });

  it('respects preferences sources and locations over profile defaults', () => {
    const profile = { ...(financeProfile as CandidateSearchProfile), sources: ['jobstreet'] };
    const plan = planner.createPlan({
      searchProfile: profile,
      preferences: {
        sources: ['loker-id'],
        locations: ['Bandung', 'Surabaya'],
        workModes: [],
        employmentTypes: [],
        maxPostingAgeDays: 7,
        unknownPostingDatePolicy: 'exclude',
      },
    });

    expect(plan.intents.length).toBeGreaterThan(0);
    for (const intent of plan.intents) {
      expect(intent.source).toBe('loker-id');
      expect(['Bandung', 'Surabaya']).toContain(intent.location!);
    }
  });

  it('normalizes and deduplicates preference locations', () => {
    const profile = techProfile as CandidateSearchProfile;
    const plan = planner.createPlan({
      searchProfile: profile,
      preferences: {
        sources: ['jobstreet'],
        locations: [' jakarta ', 'JAKARTA', 'Jakarta'],
        workModes: [],
        employmentTypes: [],
        maxPostingAgeDays: 7,
        unknownPostingDatePolicy: 'exclude',
      },
    });

    const locations = Array.from(new Set(plan.intents.map((i) => i.location)));
    expect(locations).toEqual(['Jakarta']);
  });

  it('bounds total intents to avoid query explosion', () => {
    const profile = techProfile as CandidateSearchProfile;
    const plan = planner.createPlan(
      {
        searchProfile: profile,
        preferences: {
          sources: ['jobstreet', 'loker-id'],
          locations: ['Jakarta', 'Bogor', 'Bandung', 'Surabaya'],
          workModes: [],
          employmentTypes: [],
          maxPostingAgeDays: 7,
          unknownPostingDatePolicy: 'exclude',
        },
      },
      { maxTotalIntents: 10 }
    );

    expect(plan.intents.length).toBeLessThanOrEqual(10);
  });

  it('does not mutate the candidate profile', () => {
    const profile = JSON.parse(JSON.stringify(financeProfile)) as CandidateSearchProfile;
    const originalSources = [...profile.sources];
    const originalLocations = [...profile.preferredLocations];

    planner.createPlan({
      searchProfile: profile,
      preferences: {
        sources: ['loker-id'],
        locations: ['Bali'],
        workModes: [],
        employmentTypes: [],
        maxPostingAgeDays: 14,
        unknownPostingDatePolicy: 'allow',
      },
    });

    expect(profile.sources).toEqual(originalSources);
    expect(profile.preferredLocations).toEqual(originalLocations);
  });
});
