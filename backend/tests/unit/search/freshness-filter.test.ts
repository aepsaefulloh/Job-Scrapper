import { describe, expect, it } from 'vitest';
import { evaluateFreshness } from '../../../src/search/freshness-filter.js';

describe('evaluateFreshness', () => {
  const referenceDate = new Date('2026-09-24T12:00:00.000Z');

  it('marks job posted today as eligible', () => {
    const publishedAt = new Date('2026-09-24T06:00:00.000Z');
    const result = evaluateFreshness(publishedAt, { maxPostingAgeDays: 7 }, referenceDate);
    expect(result).toEqual({ eligible: true });
  });

  it('marks job posted 1 day ago as eligible', () => {
    const publishedAt = new Date('2026-09-23T12:00:00.000Z');
    const result = evaluateFreshness(publishedAt, { maxPostingAgeDays: 7 }, referenceDate);
    expect(result).toEqual({ eligible: true });
  });

  it('marks job posted exactly 7 days ago as eligible', () => {
    const publishedAt = new Date('2026-09-17T12:00:00.000Z');
    const result = evaluateFreshness(publishedAt, { maxPostingAgeDays: 7 }, referenceDate);
    expect(result).toEqual({ eligible: true });
  });

  it('marks job posted 8 days ago as rejected with POSTING_TOO_OLD', () => {
    const publishedAt = new Date('2026-09-16T12:00:00.000Z');
    const result = evaluateFreshness(publishedAt, { maxPostingAgeDays: 7 }, referenceDate);
    expect(result).toEqual({ eligible: false, reason: 'POSTING_TOO_OLD' });
  });

  it('marks job with future posting date as eligible', () => {
    const publishedAt = new Date('2026-09-25T12:00:00.000Z');
    const result = evaluateFreshness(publishedAt, { maxPostingAgeDays: 7 }, referenceDate);
    expect(result).toEqual({ eligible: true });
  });

  it('marks unknown posting date as rejected when policy is exclude', () => {
    const resultNull = evaluateFreshness(null, { unknownPostingDatePolicy: 'exclude' }, referenceDate);
    expect(resultNull).toEqual({ eligible: false, reason: 'POSTING_DATE_UNKNOWN' });

    const resultUndefined = evaluateFreshness(undefined, { unknownPostingDatePolicy: 'exclude' }, referenceDate);
    expect(resultUndefined).toEqual({ eligible: false, reason: 'POSTING_DATE_UNKNOWN' });

    const resultInvalid = evaluateFreshness('not-a-date', { unknownPostingDatePolicy: 'exclude' }, referenceDate);
    expect(resultInvalid).toEqual({ eligible: false, reason: 'POSTING_DATE_UNKNOWN' });
  });

  it('marks unknown posting date as eligible when policy is allow', () => {
    const resultNull = evaluateFreshness(null, { unknownPostingDatePolicy: 'allow' }, referenceDate);
    expect(resultNull).toEqual({ eligible: true });

    const resultUndefined = evaluateFreshness(undefined, { unknownPostingDatePolicy: 'allow' }, referenceDate);
    expect(resultUndefined).toEqual({ eligible: true });

    const resultInvalid = evaluateFreshness('not-a-date', { unknownPostingDatePolicy: 'allow' }, referenceDate);
    expect(resultInvalid).toEqual({ eligible: true });
  });

  it('respects custom maxPostingAgeDays (e.g. 3 days)', () => {
    const pub4DaysAgo = new Date('2026-09-20T12:00:00.000Z');
    const pub2DaysAgo = new Date('2026-09-22T12:00:00.000Z');

    expect(evaluateFreshness(pub4DaysAgo, { maxPostingAgeDays: 3 }, referenceDate)).toEqual({
      eligible: false,
      reason: 'POSTING_TOO_OLD',
    });
    expect(evaluateFreshness(pub2DaysAgo, { maxPostingAgeDays: 3 }, referenceDate)).toEqual({
      eligible: true,
    });
  });

  it('uses default values when options are omitted', () => {
    const pub6DaysAgo = new Date('2026-09-18T12:00:00.000Z');
    expect(evaluateFreshness(pub6DaysAgo, undefined, referenceDate)).toEqual({ eligible: true });

    expect(evaluateFreshness(null, undefined, referenceDate)).toEqual({
      eligible: false,
      reason: 'POSTING_DATE_UNKNOWN',
    });
  });
});
