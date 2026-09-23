import type { JobSearchPreferences } from './preferences-types.js';
import { expandKeywords } from './query-expander.js';
import { normalizeLocations } from './search-preferences.service.js';
import type { CandidateSearchProfile, JobSearchIntent } from './search-types.js';

export type SearchPlanOptions = {
  maxIntentsPerRole?: number;
  defaultMaxPages?: number;
  maxTotalIntents?: number;
};

export type SearchPlanInput =
  | CandidateSearchProfile
  | {
      searchProfile: CandidateSearchProfile;
      preferences?: JobSearchPreferences;
    };

export type SearchPlan = {
  candidateId: string;
  intents: JobSearchIntent[];
  generatedAt: string;
};

export class SearchPlanner {
  public createIntents(
    input: SearchPlanInput,
    options: SearchPlanOptions = {}
  ): JobSearchIntent[] {
    const profile = 'searchProfile' in input ? input.searchProfile : input;
    const preferences = 'preferences' in input ? input.preferences : undefined;

    const { maxIntentsPerRole = 3, defaultMaxPages = 5, maxTotalIntents = 20 } = options;

    const sources =
      preferences && preferences.sources.length > 0 ? preferences.sources : profile.sources;

    const rawLocations =
      preferences && preferences.locations.length > 0
        ? preferences.locations
        : profile.preferredLocations;

    const keywords = expandKeywords(profile).slice(
      0,
      Math.min(10, Math.max(profile.targetRoles.length * maxIntentsPerRole, 3))
    );

    const normalizedLocs = normalizeLocations(rawLocations).slice(0, 4);
    const locations: Array<string | undefined> =
      normalizedLocs.length > 0 ? normalizedLocs : [undefined];

    const intents: JobSearchIntent[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      for (const location of locations) {
        for (const source of sources) {
          const key = `${source.toLowerCase()}:${keyword.toLowerCase()}:${(location ?? '').toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          intents.push({
            source,
            keyword,
            ...(location ? { location } : {}),
            maxPages: defaultMaxPages,
          });

          if (intents.length >= maxTotalIntents) {
            return intents;
          }
        }
      }
    }

    return intents;
  }

  public createPlan(input: SearchPlanInput, options?: SearchPlanOptions): SearchPlan {
    const profile = 'searchProfile' in input ? input.searchProfile : input;
    return {
      candidateId: profile.candidateId,
      intents: this.createIntents(input, options),
      generatedAt: new Date().toISOString(),
    };
  }
}
