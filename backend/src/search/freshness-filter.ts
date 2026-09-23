import { DEFAULT_SEARCH_PREFERENCES, type UnknownDatePolicy } from './preferences-types.js';

export type FreshnessFilterReason = 'POSTING_TOO_OLD' | 'POSTING_DATE_UNKNOWN';

export interface FreshnessFilterResult {
  eligible: boolean;
  reason?: FreshnessFilterReason;
}

export interface FreshnessFilterOptions {
  maxPostingAgeDays?: number;
  unknownPostingDatePolicy?: UnknownDatePolicy;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Evaluates whether a job posting satisfies freshness criteria based on publication date.
 * Deterministic date comparison using referenceDate (defaults to current time).
 */
export function evaluateFreshness(
  publishedAt?: string | Date | null,
  options?: FreshnessFilterOptions,
  referenceDate: Date = new Date()
): FreshnessFilterResult {
  const maxAgeDays = options?.maxPostingAgeDays ?? DEFAULT_SEARCH_PREFERENCES.maxPostingAgeDays;
  const unknownPolicy =
    options?.unknownPostingDatePolicy ?? DEFAULT_SEARCH_PREFERENCES.unknownPostingDatePolicy;

  if (!publishedAt) {
    if (unknownPolicy === 'allow') {
      return { eligible: true };
    }
    return { eligible: false, reason: 'POSTING_DATE_UNKNOWN' };
  }

  const pubDate = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  const pubTime = pubDate.getTime();

  if (isNaN(pubTime)) {
    if (unknownPolicy === 'allow') {
      return { eligible: true };
    }
    return { eligible: false, reason: 'POSTING_DATE_UNKNOWN' };
  }

  const diffMs = referenceDate.getTime() - pubTime;
  const maxAgeMs = maxAgeDays * MS_PER_DAY;

  if (diffMs > maxAgeMs) {
    return { eligible: false, reason: 'POSTING_TOO_OLD' };
  }

  return { eligible: true };
}
