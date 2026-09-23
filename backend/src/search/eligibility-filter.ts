import { normalizeKeyword } from './role-alias-registry.js';
import type { CandidateSearchProfile, HardFilterInput, HardFilterResult } from './search-types.js';

/**
 * Apply hard filters to determine if a job is eligible for matching.
 * Rejects based on: blocked company, excluded role keywords, excluded keywords, expiry.
 * Does NOT reject based on missing skills — skill matching belongs in the scoring layer.
 */
export function applyHardFilters(
  job: HardFilterInput,
  profile: CandidateSearchProfile
): HardFilterResult {
  const title = normalizeKeyword(job.title);
  const company = normalizeKeyword(job.companyName);

  // 1. Blocked company (exact match on normalized name)
  for (const blocked of profile.excludedCompanies) {
    if (company === normalizeKeyword(blocked)) {
      return { eligible: false, reason: `Excluded company: ${job.companyName}` };
    }
  }

  // 2. Excluded role keywords in title (substring match)
  for (const role of profile.excludedRoles) {
    if (title.includes(normalizeKeyword(role))) {
      return { eligible: false, reason: `Excluded role keyword in title: ${role}` };
    }
  }

  // 3. Excluded keywords in title (substring match)
  for (const kw of profile.excludedKeywords) {
    if (title.includes(normalizeKeyword(kw))) {
      return { eligible: false, reason: `Excluded keyword in title: ${kw}` };
    }
  }

  // 4. Expired job
  if (job.expiresAt) {
    const expires = new Date(job.expiresAt);
    if (!isNaN(expires.getTime()) && expires < new Date()) {
      return { eligible: false, reason: `Job expired at ${job.expiresAt}` };
    }
  }

  return { eligible: true };
}
