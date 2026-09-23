import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import type {
  EmploymentTypePreference,
  JobSearchPreferences,
  SupportedJobSource,
  UnknownDatePolicy,
  WorkModePreference,
} from './preferences-types.js';

export interface SearchPreferencesRepository {
  get(candidateId: string): Promise<JobSearchPreferences | null>;
  save(candidateId: string, preferences: JobSearchPreferences): Promise<JobSearchPreferences>;
}

export class SupabaseSearchPreferencesRepository implements SearchPreferencesRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async get(candidateId: string): Promise<JobSearchPreferences | null> {
    const { data, error } = await this.client
      .from('candidate_job_search_preferences')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load search preferences: ${error.message}`);
    }

    if (!data) return null;

    return {
      sources: (data.sources as unknown as SupportedJobSource[]) || [],
      locations: (data.locations as unknown as string[]) || [],
      workModes: (data.work_modes as unknown as WorkModePreference[]) || [],
      employmentTypes: (data.employment_types as unknown as EmploymentTypePreference[]) || [],
      maxPostingAgeDays: data.max_posting_age_days,
      unknownPostingDatePolicy: data.unknown_posting_date_policy as UnknownDatePolicy,
    };
  }

  public async save(
    candidateId: string,
    preferences: JobSearchPreferences
  ): Promise<JobSearchPreferences> {
    const { data, error } = await this.client
      .from('candidate_job_search_preferences')
      .upsert(
        {
          candidate_id: candidateId,
          sources: preferences.sources as never,
          locations: preferences.locations as never,
          work_modes: preferences.workModes as never,
          employment_types: preferences.employmentTypes as never,
          max_posting_age_days: preferences.maxPostingAgeDays,
          unknown_posting_date_policy: preferences.unknownPostingDatePolicy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' }
      )
      .select('*')
      .single();

    if (error) {
      throw new Error(`Could not save search preferences: ${error.message}`);
    }

    return {
      sources: (data.sources as unknown as SupportedJobSource[]) || [],
      locations: (data.locations as unknown as string[]) || [],
      workModes: (data.work_modes as unknown as WorkModePreference[]) || [],
      employmentTypes: (data.employment_types as unknown as EmploymentTypePreference[]) || [],
      maxPostingAgeDays: data.max_posting_age_days,
      unknownPostingDatePolicy: data.unknown_posting_date_policy as UnknownDatePolicy,
    };
  }
}
