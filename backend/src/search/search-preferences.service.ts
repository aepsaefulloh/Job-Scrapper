import {
  DEFAULT_SEARCH_PREFERENCES,
  SUPPORTED_EMPLOYMENT_TYPES,
  SUPPORTED_JOB_SOURCES,
  SUPPORTED_UNKNOWN_DATE_POLICIES,
  SUPPORTED_WORK_MODES,
  type EmploymentTypePreference,
  type JobSearchPreferences,
  type SupportedJobSource,
  type UnknownDatePolicy,
  type WorkModePreference,
} from './preferences-types.js';
import type { SearchPreferencesRepository } from './search-preferences.repository.js';

export function normalizeLocation(loc: string): string {
  const trimmed = loc.trim();
  if (!trimmed) return '';
  if (trimmed === trimmed.toLowerCase() || trimmed === trimmed.toUpperCase()) {
    return trimmed
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return trimmed;
}

export function normalizeLocations(locations: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const loc of locations) {
    const norm = normalizeLocation(loc);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(norm);
    }
  }
  return result;
}

export class SearchPreferencesService {
  public constructor(private readonly repository: SearchPreferencesRepository) {}

  public async getPreferences(candidateId: string): Promise<JobSearchPreferences> {
    const existing = await this.repository.get(candidateId);
    if (!existing) {
      return { ...DEFAULT_SEARCH_PREFERENCES };
    }
    return existing;
  }

  public async updatePreferences(
    candidateId: string,
    input: Partial<JobSearchPreferences>
  ): Promise<JobSearchPreferences> {
    const current = await this.getPreferences(candidateId);

    let sources = current.sources;
    if (input.sources !== undefined) {
      if (!Array.isArray(input.sources)) {
        throw new Error('sources must be an array');
      }
      for (const s of input.sources) {
        if (!SUPPORTED_JOB_SOURCES.includes(s as SupportedJobSource)) {
          throw new Error(`Unsupported job source: "${s}". Supported sources: ${SUPPORTED_JOB_SOURCES.join(', ')}`);
        }
      }
      sources = Array.from(new Set(input.sources));
    }

    let locations = current.locations;
    if (input.locations !== undefined) {
      if (!Array.isArray(input.locations)) {
        throw new Error('locations must be an array');
      }
      locations = normalizeLocations(input.locations);
    }

    let workModes = current.workModes;
    if (input.workModes !== undefined) {
      if (!Array.isArray(input.workModes)) {
        throw new Error('workModes must be an array');
      }
      for (const wm of input.workModes) {
        if (!SUPPORTED_WORK_MODES.includes(wm as WorkModePreference)) {
          throw new Error(
            `Unsupported work mode: "${wm}". Supported work modes: ${SUPPORTED_WORK_MODES.join(', ')}`
          );
        }
      }
      workModes = Array.from(new Set(input.workModes));
    }

    let employmentTypes = current.employmentTypes;
    if (input.employmentTypes !== undefined) {
      if (!Array.isArray(input.employmentTypes)) {
        throw new Error('employmentTypes must be an array');
      }
      for (const et of input.employmentTypes) {
        if (!SUPPORTED_EMPLOYMENT_TYPES.includes(et as EmploymentTypePreference)) {
          throw new Error(
            `Unsupported employment type: "${et}". Supported types: ${SUPPORTED_EMPLOYMENT_TYPES.join(', ')}`
          );
        }
      }
      employmentTypes = Array.from(new Set(input.employmentTypes));
    }

    let maxPostingAgeDays = current.maxPostingAgeDays;
    if (input.maxPostingAgeDays !== undefined) {
      if (
        typeof input.maxPostingAgeDays !== 'number' ||
        isNaN(input.maxPostingAgeDays) ||
        input.maxPostingAgeDays < 1 ||
        input.maxPostingAgeDays > 90
      ) {
        throw new Error('maxPostingAgeDays must be a number between 1 and 90');
      }
      maxPostingAgeDays = Math.floor(input.maxPostingAgeDays);
    }

    let unknownPostingDatePolicy = current.unknownPostingDatePolicy;
    if (input.unknownPostingDatePolicy !== undefined) {
      if (!SUPPORTED_UNKNOWN_DATE_POLICIES.includes(input.unknownPostingDatePolicy as UnknownDatePolicy)) {
        throw new Error(
          `Unsupported unknownPostingDatePolicy: "${input.unknownPostingDatePolicy}". Supported policies: ${SUPPORTED_UNKNOWN_DATE_POLICIES.join(', ')}`
        );
      }
      unknownPostingDatePolicy = input.unknownPostingDatePolicy;
    }

    const updated: JobSearchPreferences = {
      sources,
      locations,
      workModes,
      employmentTypes,
      maxPostingAgeDays,
      unknownPostingDatePolicy,
    };

    return this.repository.save(candidateId, updated);
  }
}
