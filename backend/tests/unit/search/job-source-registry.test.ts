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

  it('marks newly added sources as available with correct capabilities', () => {
    const availableIds = getAvailableJobSourceIds();
    expect(availableIds).toContain('kitalulus');
    expect(availableIds).toContain('kalibrr');
    expect(availableIds).toContain('karir');
    expect(availableIds).toContain('indeed');
    expect(availableIds).toContain('linkedin');

    expect(isJobSourceAvailable('kitalulus')).toBe(true);
    expect(isJobSourceAvailable('kalibrr')).toBe(true);
    expect(isJobSourceAvailable('karir')).toBe(true);
    expect(isJobSourceAvailable('karir-com')).toBe(true); // alias support
    expect(isJobSourceAvailable('indeed')).toBe(true);
    expect(isJobSourceAvailable('linkedin')).toBe(true);

    const indeed = getJobSourceDefinition('indeed');
    expect(indeed?.supportsFreshness).toBe(true);
    expect(indeed?.supportsLocation).toBe(true);

    const linkedin = getJobSourceDefinition('linkedin');
    expect(linkedin?.supportsFreshness).toBe(true);
    expect(linkedin?.supportsWorkMode).toBe(true);
  });

  it('returns false for unknown source IDs', () => {
    expect(isJobSourceAvailable('unknown-portal')).toBe(false);
  });
});
