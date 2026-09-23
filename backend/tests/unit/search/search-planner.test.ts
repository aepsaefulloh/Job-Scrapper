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
});
