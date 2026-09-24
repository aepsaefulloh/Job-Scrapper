import type { CandidateSearchProfile } from '../../search/search-types.js';

export type CandidateMatchContext = {
  targetRoles: string[];
  skills: string[];
  experienceYears?: number;
  seniority: string[];
  industries: string[];
  preferredLocations: string[];
  workModes: string[];
  employmentTypes: string[];
};

export function buildCandidateMatchContext(
  profile: CandidateSearchProfile
): CandidateMatchContext {
  return {
    targetRoles: compactList(profile.targetRoles, 10),
    skills: compactList([...profile.primarySkills, ...profile.secondarySkills], 40),
    ...(profile.experienceYears === undefined
      ? {}
      : { experienceYears: profile.experienceYears }),
    seniority: compactList(profile.seniority, 10),
    industries: compactList(profile.industries, 10),
    preferredLocations: compactList(profile.preferredLocations, 10),
    workModes: compactList(profile.workModes, 10),
    employmentTypes: compactList(profile.employmentTypes, 10),
  };
}

function compactList(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const compact = value.replace(/\s+/g, ' ').trim().slice(0, 200);
    const key = compact.toLocaleLowerCase();
    if (!compact || seen.has(key)) continue;
    seen.add(key);
    result.push(compact);
    if (result.length === limit) break;
  }

  return result;
}
