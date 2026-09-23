import { describe, expect, it } from 'vitest';
import { parseRelativeDate } from '../../../src/domain/job/relative-date-parser.js';

describe('parseRelativeDate', () => {
  const frozenDate = new Date('2026-09-24T12:00:00.000Z');

  it('parses standard ISO date strings directly', () => {
    expect(parseRelativeDate('2026-09-20T08:00:00.000Z', frozenDate)).toBe('2026-09-20T08:00:00.000Z');
    expect(parseRelativeDate('2026-09-15', frozenDate)).toBe('2026-09-15T00:00:00.000Z');
  });

  it('parses "Today" and "Hari ini"', () => {
    expect(parseRelativeDate('Today', frozenDate)).toBe('2026-09-24T12:00:00.000Z');
    expect(parseRelativeDate('Hari ini', frozenDate)).toBe('2026-09-24T12:00:00.000Z');
    expect(parseRelativeDate('baru saja', frozenDate)).toBe('2026-09-24T12:00:00.000Z');
    expect(parseRelativeDate('3 jam lalu', frozenDate)).toBe('2026-09-24T12:00:00.000Z');
  });

  it('parses "Yesterday" and "Kemarin"', () => {
    expect(parseRelativeDate('Yesterday', frozenDate)).toBe('2026-09-23T12:00:00.000Z');
    expect(parseRelativeDate('kemarin', frozenDate)).toBe('2026-09-23T12:00:00.000Z');
  });

  it('parses relative days in English and Indonesian', () => {
    expect(parseRelativeDate('3 days ago', frozenDate)).toBe('2026-09-21T12:00:00.000Z');
    expect(parseRelativeDate('3 hari lalu', frozenDate)).toBe('2026-09-21T12:00:00.000Z');
    expect(parseRelativeDate('7 hari yang lalu', frozenDate)).toBe('2026-09-17T12:00:00.000Z');
    expect(parseRelativeDate('2d ago', frozenDate)).toBe('2026-09-22T12:00:00.000Z');
    expect(parseRelativeDate('Posted 5 days ago', frozenDate)).toBe('2026-09-19T12:00:00.000Z');
    expect(parseRelativeDate('Diposting 2 hari lalu', frozenDate)).toBe('2026-09-22T12:00:00.000Z');
  });

  it('parses relative weeks in English and Indonesian', () => {
    expect(parseRelativeDate('1 week ago', frozenDate)).toBe('2026-09-17T12:00:00.000Z');
    expect(parseRelativeDate('2 minggu lalu', frozenDate)).toBe('2026-09-10T12:00:00.000Z');
  });

  it('returns undefined for malformed or unparseable input', () => {
    expect(parseRelativeDate(undefined, frozenDate)).toBeUndefined();
    expect(parseRelativeDate(null, frozenDate)).toBeUndefined();
    expect(parseRelativeDate('', frozenDate)).toBeUndefined();
    expect(parseRelativeDate('not a date', frozenDate)).toBeUndefined();
    expect(parseRelativeDate('segera ditutup', frozenDate)).toBeUndefined();
  });
});
