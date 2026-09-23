import { describe, it, expect } from 'vitest';
import { expandKeywords } from '../../../src/search/query-expander.js';
import techProfile from '../../fixtures/search-profile-tech.json';
import financeProfile from '../../fixtures/search-profile-finance.json';
import marketingProfile from '../../fixtures/search-profile-marketing.json';
import opsProfile from '../../fixtures/search-profile-ops.json';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

describe('expandKeywords', () => {
  it('expands tech target role into multiple keywords', () => {
    const keywords = expandKeywords(techProfile as CandidateSearchProfile);
    expect(keywords).toContain('frontend developer');
    expect(keywords).toContain('frontend engineer');
    expect(keywords).toContain('web developer');
  });

  it('expands finance target role into multiple keywords', () => {
    const keywords = expandKeywords(financeProfile as CandidateSearchProfile);
    expect(keywords).toContain('accountant');
    expect(keywords).toContain('accounting staff');
    expect(keywords).toContain('finance accounting');
  });

  it('expands multiple marketing roles', () => {
    const keywords = expandKeywords(marketingProfile as CandidateSearchProfile);
    expect(keywords).toContain('digital marketing');
    expect(keywords).toContain('content writer');
    expect(keywords).toContain('copywriter');
  });

  it('expands ops profile (non-technical)', () => {
    const keywords = expandKeywords(opsProfile as CandidateSearchProfile);
    expect(keywords).toContain('administration');
    expect(keywords).toContain('admin');
    expect(keywords).toContain('operations');
  });

  it('does not return duplicate keywords', () => {
    const keywords = expandKeywords(financeProfile as CandidateSearchProfile);
    const unique = new Set(keywords);
    expect(unique.size).toBe(keywords.length);
  });

  it('does not include excluded roles', () => {
    const keywords = expandKeywords(techProfile as CandidateSearchProfile);
    expect(keywords).not.toContain('internship');
  });
});
