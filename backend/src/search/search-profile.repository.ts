import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import type { CandidateSearchProfile } from './search-types.js';

export interface SearchProfileRepository {
  get(candidateId: string): Promise<CandidateSearchProfile | null>;
  save(profile: CandidateSearchProfile): Promise<void>;
}

export class SupabaseSearchProfileRepository implements SearchProfileRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async get(candidateId: string): Promise<CandidateSearchProfile | null> {
    const { data, error } = await this.client
      .from('candidate_search_profiles')
      .select('profile_data, source_profile_id, source_profile_updated_at')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    if (error) throw new Error('Could not load candidate search profile.');
    if (!data) return null;
    const profile = data.profile_data as unknown as CandidateSearchProfile;
    if (data.source_profile_id && !profile.sourceProfileId) {
      profile.sourceProfileId = data.source_profile_id;
    }
    if (data.source_profile_updated_at && !profile.sourceProfileUpdatedAt) {
      profile.sourceProfileUpdatedAt = data.source_profile_updated_at;
    }
    return profile;
  }

  public async save(profile: CandidateSearchProfile): Promise<void> {
    const { error } = await this.client
      .from('candidate_search_profiles')
      .upsert(
        {
          candidate_id: profile.candidateId,
          source_profile_id: profile.sourceProfileId ?? null,
          source_profile_updated_at: profile.sourceProfileUpdatedAt ?? null,
          profile_data: profile as never,
          generated_at: profile.generatedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' }
      );
    if (error) throw new Error('Could not save candidate search profile.');
  }
}
