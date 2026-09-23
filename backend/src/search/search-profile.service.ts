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
  const parts = headline
    .split(/[\/|,•·;]/)
    .map(p => p.replace(/^(sebagai|as|seorang|a|an)\s+/i, '').trim())
    .filter(p => p.length > 0);
  return parts.length > 0 ? parts : [headline.trim()];
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
      sourceProfileId: profile.id,
      sourceProfileUpdatedAt: profile.updatedAt,
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
   * Return the existing persisted search profile if fresh, or derive and save an updated one.
   * Profile is invalidated if source candidate profile ID or updatedAt has changed.
   */
  public async getOrDerive(
    candidateId: string,
    profile: CandidateProfileDetail
  ): Promise<CandidateSearchProfile> {
    const existing = await this.repository.get(candidateId);
    if (
      existing &&
      existing.sourceProfileId === profile.id &&
      existing.sourceProfileUpdatedAt === profile.updatedAt
    ) {
      return existing;
    }

    const derived = this.deriveFromProfile(profile, candidateId);
    if (existing) {
      if (existing.preferredLocations.length > 0) derived.preferredLocations = existing.preferredLocations;
      if (existing.workModes.length > 0) derived.workModes = existing.workModes;
      if (existing.employmentTypes.length > 0) derived.employmentTypes = existing.employmentTypes;
      if (existing.excludedRoles.length > 0) derived.excludedRoles = existing.excludedRoles;
      if (existing.excludedKeywords.length > 0) derived.excludedKeywords = existing.excludedKeywords;
      if (existing.excludedCompanies.length > 0) derived.excludedCompanies = existing.excludedCompanies;
      if (existing.sources.length > 0) derived.sources = existing.sources;
    }

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
