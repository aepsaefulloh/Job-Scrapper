import type { JobSearchPreferences } from './preferences-types.js';

export interface FilterableJob {
  id: string;
  title: string;
  companyName?: string;
  source: string;
  status: string;
  location?: string | null;
  employmentType?: string | null;
  publishedAt?: string | null;
  deletedAt?: string | null;
}

export interface FilterResult {
  eligible: boolean;
  reason?:
    | 'DELETED'
    | 'STATUS_NOT_ACTIVE'
    | 'POSTING_TOO_OLD'
    | 'SOURCE_NOT_SELECTED'
    | 'LOCATION_MISMATCH'
    | 'ROLE_EXCLUDED'
    | 'EMPLOYMENT_TYPE_MISMATCH';
}

export function filterJobForLlm(
  job: FilterableJob,
  preferences?: Partial<JobSearchPreferences>
): FilterResult {
  if (job.deletedAt) {
    return { eligible: false, reason: 'DELETED' };
  }

  if (job.status !== 'active') {
    return { eligible: false, reason: 'STATUS_NOT_ACTIVE' };
  }

  if (!preferences) {
    return { eligible: true };
  }

  // 1. Source check
  if (preferences.sources && preferences.sources.length > 0) {
    const jobSource = job.source.toLowerCase().trim();
    const sourceAllowed = preferences.sources.some(
      (s) => s.toLowerCase().trim() === jobSource
    );
    if (!sourceAllowed) {
      return { eligible: false, reason: 'SOURCE_NOT_SELECTED' };
    }
  }

  // 2. Excluded roles check
  if (preferences.excludedRoles && preferences.excludedRoles.length > 0) {
    const titleLower = job.title.toLowerCase();
    for (const excluded of preferences.excludedRoles) {
      const trimmed = excluded.trim().toLowerCase();
      if (trimmed && titleLower.includes(trimmed)) {
        return { eligible: false, reason: 'ROLE_EXCLUDED' };
      }
    }
  }

  // 3. Posting age check
  if (preferences.maxPostingAgeDays !== undefined && preferences.maxPostingAgeDays > 0) {
    if (job.publishedAt) {
      const published = new Date(job.publishedAt).getTime();
      if (!isNaN(published)) {
        const ageMs = Date.now() - published;
        const maxAgeMs = preferences.maxPostingAgeDays * 24 * 60 * 60 * 1000;
        if (ageMs > maxAgeMs) {
          return { eligible: false, reason: 'POSTING_TOO_OLD' };
        }
      }
    } else if (preferences.unknownPostingDatePolicy === 'exclude') {
      return { eligible: false, reason: 'POSTING_TOO_OLD' };
    }
  }

  // 4. Preferred locations check
  if (preferences.locations && preferences.locations.length > 0) {
    if (!job.location) {
      const allowsRemote = preferences.locations.some((l) =>
        l.toLowerCase().includes('remote')
      );
      if (!allowsRemote) {
        return { eligible: false, reason: 'LOCATION_MISMATCH' };
      }
    } else {
      const jobLocLower = job.location.toLowerCase();
      const locationMatched = preferences.locations.some((loc) => {
        const lLower = loc.trim().toLowerCase();
        return lLower && (jobLocLower.includes(lLower) || lLower.includes(jobLocLower));
      });
      if (!locationMatched) {
        return { eligible: false, reason: 'LOCATION_MISMATCH' };
      }
    }
  }

  // 5. Employment type check
  if (preferences.employmentTypes && preferences.employmentTypes.length > 0 && job.employmentType) {
    const jobEmpLower = job.employmentType.toLowerCase().trim();
    const empMatched = preferences.employmentTypes.some((et) => {
      const eLower = et.toLowerCase().trim();
      return eLower && (jobEmpLower.includes(eLower) || eLower.includes(jobEmpLower));
    });
    if (!empMatched) {
      return { eligible: false, reason: 'EMPLOYMENT_TYPE_MISMATCH' };
    }
  }

  return { eligible: true };
}

export function filterJobsForLlm(
  jobs: FilterableJob[],
  preferences?: Partial<JobSearchPreferences>
): FilterableJob[] {
  return jobs.filter((job) => filterJobForLlm(job, preferences).eligible);
}
