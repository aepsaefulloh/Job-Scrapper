import type { CandidateProfileDetail } from '../infrastructure/supabase/profile-repository.js';
import type { SearchProfileRepository } from './search-profile.repository.js';
import type { CandidateSearchProfile } from './search-types.js';

const PRIMARY_SKILL_LIMIT = 10;
const SECONDARY_SKILL_LIMIT = 10;
const DEFAULT_SOURCES = ['jobstreet'] as const;

/**
 * Attempt to extract a meaningful role name from the candidate headline.
 * Strips common leading filler words and returns the core phrase.
 */
function deriveTargetRoles(headline: string | null): string[] {
  if (!headline) return [];
  const cleaned = headline
    .replace(/^(sebagai|as|seorang|a|an)\s+/i, '')
    .trim();
  return cleaned ? [cleaned] : [];
}

export class SearchProfileService {
  public constructor(private readonly repository: SearchProfileRepository) {}

  /**
   * Derive a CandidateSearchProfile from a parsed candidate profile.
   * Deterministic, no LLM calls.
   */
  public deriveFromProfile(
    profile: CandidateProfileDetail,
    candidateId: string
  ): CandidateSearchProfile {
    const allSkills = profile.skills.map(s => s.displayName);
    return {
      candidateId,
      targetRoles: deriveTargetRoles(profile.headline ?? null),
      roleAliases: [],
      primarySkills: allSkills.slice(0, PRIMARY_SKILL_LIMIT),
      secondarySkills: allSkills.slice(PRIMARY_SKILL_LIMIT, PRIMARY_SKILL_LIMIT + SECONDARY_SKILL_LIMIT),
      industries: [],
      seniority: [],
      preferredLocations: [],
      workModes: [],
      employmentTypes: ['full-time'],
      excludedRoles: [],
      excludedKeywords: [],
      excludedCompanies: [],
      languages: [],
      sources: [...DEFAULT_SOURCES],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Return the existing persisted search profile, or derive and save a new one.
   */
  public async getOrDerive(
    candidateId: string,
    profile: CandidateProfileDetail
  ): Promise<CandidateSearchProfile> {
    const existing = await this.repository.get(candidateId);
    if (existing) return existing;
    const derived = this.deriveFromProfile(profile, candidateId);
    await this.repository.save(derived);
    return derived;
  }

  public async get(candidateId: string): Promise<CandidateSearchProfile | null> {
    return this.repository.get(candidateId);
  }

  public async save(profile: CandidateSearchProfile): Promise<void> {
    return this.repository.save(profile);
  }
}
