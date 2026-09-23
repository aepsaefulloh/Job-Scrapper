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
    // candidate_search_profiles is not in generated types yet — cast to bypass
    const { data, error } = await (this.client as SupabaseClient)
      .from('candidate_search_profiles')
      .select('profile_data')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    if (error) throw new Error('Could not load candidate search profile.');
    if (!data) return null;
    return (data as { profile_data: unknown }).profile_data as CandidateSearchProfile;
  }

  public async save(profile: CandidateSearchProfile): Promise<void> {
    const { error } = await (this.client as SupabaseClient)
      .from('candidate_search_profiles')
      .upsert(
        {
          candidate_id: profile.candidateId,
          profile_data: profile,
          generated_at: profile.generatedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' }
      );
    if (error) throw new Error('Could not save candidate search profile.');
  }
}
