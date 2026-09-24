import { describe, expect, it } from 'vitest';
import {
  JOB_SOURCE_REGISTRY,
  getAvailableJobSourceIds,
  isJobSourceAvailable,
} from '../../../src/search/job-source-registry.js';

describe('Job Source Registry', () => {
  it('contains Jobstreet and Loker.id as available sources', () => {
    const availableIds = getAvailableJobSourceIds();
    expect(availableIds).toContain('jobstreet');
    expect(availableIds).toContain('loker-id');
  });

  it('marks upcoming sources as unavailable (coming soon)', () => {
    expect(isJobSourceAvailable('dealls')).toBe(false);
    expect(isJobSourceAvailable('glints')).toBe(false);
    expect(isJobSourceAvailable('linkedin')).toBe(false);
    expect(isJobSourceAvailable('indeed')).toBe(false);
    expect(isJobSourceAvailable('kitalulus')).toBe(false);
    expect(isJobSourceAvailable('kalibrr')).toBe(false);
    expect(isJobSourceAvailable('karir-com')).toBe(false);
  });

  it('returns false for unknown source IDs', () => {
    expect(isJobSourceAvailable('unknown-portal')).toBe(false);
  });
});
