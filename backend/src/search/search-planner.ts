import { expandKeywords } from './query-expander.js';
import type { CandidateSearchProfile, JobSearchIntent } from './search-types.js';

export type SearchPlanOptions = {
  maxIntentsPerRole?: number;
  defaultMaxPages?: number;
};

export type SearchPlan = {
  candidateId: string;
  intents: JobSearchIntent[];
  generatedAt: string;
};

export class SearchPlanner {
  public createIntents(
    profile: CandidateSearchProfile,
    options: SearchPlanOptions = {}
  ): JobSearchIntent[] {
    const { maxIntentsPerRole = 5, defaultMaxPages = 5 } = options;
    const keywords = expandKeywords(profile).slice(0, profile.targetRoles.length * maxIntentsPerRole);
    const locations: Array<string | undefined> =
      profile.preferredLocations.length > 0 ? profile.preferredLocations : [undefined];
    const intents: JobSearchIntent[] = [];
    const seen = new Set<string>();

    for (const source of profile.sources) {
      for (const keyword of keywords) {
        for (const location of locations) {
          const key = `${source}:${keyword}:${location ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          intents.push({
            source,
            keyword,
            ...(location ? { location } : {}),
            maxPages: defaultMaxPages,
          });
        }
      }
    }

    return intents;
  }

  public createPlan(profile: CandidateSearchProfile, options?: SearchPlanOptions): SearchPlan {
    return {
      candidateId: profile.candidateId,
      intents: this.createIntents(profile, options),
      generatedAt: new Date().toISOString(),
    };
  }
}
