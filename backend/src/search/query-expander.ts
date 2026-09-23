import { expandRoleAliases, normalizeKeyword } from './role-alias-registry.js';
import type { CandidateSearchProfile } from './search-types.js';

/**
 * Expand a candidate search profile into a deduplicated list of search keywords.
 * Excludes any keyword that matches an excluded role.
 */
export function expandKeywords(profile: CandidateSearchProfile): string[] {
  const excluded = new Set(profile.excludedRoles.map(normalizeKeyword));
  const seen = new Set<string>();
  const results: string[] = [];

  for (const role of profile.targetRoles) {
    for (const alias of expandRoleAliases(role)) {
      const normalized = normalizeKeyword(alias);
      if (!excluded.has(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        results.push(normalized);
      }
    }
  }

  // Also include any explicit roleAliases the profile already carries
  for (const alias of profile.roleAliases) {
    const normalized = normalizeKeyword(alias);
    if (!excluded.has(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      results.push(normalized);
    }
  }

  return results;
}
