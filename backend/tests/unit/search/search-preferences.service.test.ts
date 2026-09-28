import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_PREFERENCES,
  type JobSearchPreferences,
} from '../../../src/search/preferences-types.js';
import type { SearchPreferencesRepository } from '../../../src/search/search-preferences.repository.js';
import {
  normalizeLocation,
  normalizeLocations,
  SearchPreferencesService,
} from '../../../src/search/search-preferences.service.js';

class InMemorySearchPreferencesRepository implements SearchPreferencesRepository {
  private store = new Map<string, JobSearchPreferences>();

  public async get(candidateId: string): Promise<JobSearchPreferences | null> {
    return this.store.get(candidateId) ?? null;
  }

  public async save(
    candidateId: string,
    preferences: JobSearchPreferences
  ): Promise<JobSearchPreferences> {
    this.store.set(candidateId, { ...preferences });
    return { ...preferences };
  }
}

describe('normalizeLocation and normalizeLocations', () => {
  it('normalizes single location casing and whitespace', () => {
    expect(normalizeLocation(' jakarta ')).toBe('Jakarta');
    expect(normalizeLocation('JAKARTA')).toBe('Jakarta');
    expect(normalizeLocation('dki jakarta')).toBe('Dki Jakarta');
    expect(normalizeLocation('South Jakarta')).toBe('South Jakarta');
    expect(normalizeLocation('   ')).toBe('');
  });

  it('deduplicates locations case-insensitively', () => {
    const raw = [' jakarta ', 'Jakarta', 'JAKARTA', 'Bogor', '  bogor  ', 'Bandung'];
    const normalized = normalizeLocations(raw);
    expect(normalized).toEqual(['Jakarta', 'Bogor', 'Bandung']);
  });
});

describe('SearchPreferencesService', () => {
  it('returns default preferences when candidate has no saved preferences', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    const prefs = await service.getPreferences('candidate-1');
    expect(prefs).toEqual(DEFAULT_SEARCH_PREFERENCES);
    expect(prefs.maxPostingAgeDays).toBe(7);
    expect(prefs.sources).toEqual(['jobstreet', 'loker-id']);
    expect(prefs.unknownPostingDatePolicy).toBe('exclude');
  });

  it('saves and updates preferences with candidate isolation', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    await service.updatePreferences('candidate-1', {
      sources: ['jobstreet'],
      locations: ['Jakarta', 'Bogor'],
      maxPostingAgeDays: 14,
    });

    const c1Prefs = await service.getPreferences('candidate-1');
    expect(c1Prefs.sources).toEqual(['jobstreet']);
    expect(c1Prefs.locations).toEqual(['Jakarta', 'Bogor']);
    expect(c1Prefs.maxPostingAgeDays).toBe(14);

    // candidate-2 should still receive defaults
    const c2Prefs = await service.getPreferences('candidate-2');
    expect(c2Prefs).toEqual(DEFAULT_SEARCH_PREFERENCES);
  });

  it('rejects unsupported sources', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    await expect(
      service.updatePreferences('candidate-1', {
        sources: ['fake-portal' as any],
      })
    ).rejects.toThrow('Unsupported job source: "fake-portal"');

    await expect(
      service.updatePreferences('candidate-1', {
        sources: ['monster' as any],
      })
    ).rejects.toThrow('Unsupported job source: "monster"');
  });

  it('validates work modes and employment types', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    await expect(
      service.updatePreferences('candidate-1', {
        workModes: ['telecommute' as any],
      })
    ).rejects.toThrow('Unsupported work mode: "telecommute"');

    await expect(
      service.updatePreferences('candidate-1', {
        employmentTypes: ['temporary' as any],
      })
    ).rejects.toThrow('Unsupported employment type: "temporary"');

    const valid = await service.updatePreferences('candidate-1', {
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full-time', 'contract'],
    });
    expect(valid.workModes).toEqual(['remote', 'hybrid']);
    expect(valid.employmentTypes).toEqual(['full-time', 'contract']);
  });

  it('validates maxPostingAgeDays bounds', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    await expect(
      service.updatePreferences('candidate-1', {
        maxPostingAgeDays: 0,
      })
    ).rejects.toThrow('maxPostingAgeDays must be a number between 1 and 90');

    await expect(
      service.updatePreferences('candidate-1', {
        maxPostingAgeDays: 100,
      })
    ).rejects.toThrow('maxPostingAgeDays must be a number between 1 and 90');

    await expect(
      service.updatePreferences('candidate-1', {
        maxPostingAgeDays: NaN,
      })
    ).rejects.toThrow('maxPostingAgeDays must be a number between 1 and 90');
  });

  it('validates unknownPostingDatePolicy', async () => {
    const repo = new InMemorySearchPreferencesRepository();
    const service = new SearchPreferencesService(repo);

    await expect(
      service.updatePreferences('candidate-1', {
        unknownPostingDatePolicy: 'ignore' as any,
      })
    ).rejects.toThrow('Unsupported unknownPostingDatePolicy: "ignore"');

    const updated = await service.updatePreferences('candidate-1', {
      unknownPostingDatePolicy: 'allow',
    });
    expect(updated.unknownPostingDatePolicy).toBe('allow');
  });
});
