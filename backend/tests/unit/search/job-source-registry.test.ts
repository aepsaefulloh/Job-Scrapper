import { describe, expect, it } from 'vitest';
import {
  JOB_SOURCE_REGISTRY,
  getAvailableJobSourceIds,
  isJobSourceAvailable,
  getJobSourceDefinition,
} from '../../../src/search/job-source-registry.js';

describe('Job Source Registry', () => {
  it('contains Jobstreet, Loker.id, Dealls, and Glints as available sources with required capabilities', () => {
    const availableIds = getAvailableJobSourceIds();
    expect(availableIds).toContain('jobstreet');
    expect(availableIds).toContain('loker-id');
    expect(availableIds).toContain('dealls');
    expect(availableIds).toContain('glints');

    const dealls = getJobSourceDefinition('dealls');
    expect(dealls).toBeDefined();
    expect(dealls?.available).toBe(true);
    expect(typeof dealls?.supportsLocation).toBe('boolean');
    expect(typeof dealls?.supportsFreshness).toBe('boolean');
    expect(typeof dealls?.supportsWorkMode).toBe('boolean');

    const glints = getJobSourceDefinition('glints');
    expect(glints).toBeDefined();
    expect(glints?.available).toBe(true);
    expect(typeof glints?.supportsLocation).toBe('boolean');
    expect(typeof glints?.supportsFreshness).toBe('boolean');
    expect(typeof glints?.supportsWorkMode).toBe('boolean');
  });

  it('marks upcoming sources as unavailable (coming soon)', () => {
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
