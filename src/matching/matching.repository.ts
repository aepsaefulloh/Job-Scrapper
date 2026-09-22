import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import { MatchingError } from './types.js';

export interface MatchingRepository {
  getProfileEmbedding(candidateId: string): Promise<number[] | null>;
  match(candidateId: string, embedding: number[], limit: number, threshold: number): Promise<Array<{ job_id: string; similarity: number }>>;
}

export class SupabaseMatchingRepository implements MatchingRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async getProfileEmbedding(candidateId: string): Promise<number[] | null> {
    const { data, error } = await this.client.from('profiles').select('embedding, embedding_status').eq('candidate_id', candidateId).eq('is_active', true).is('deleted_at', null).single();
    if (error || !data || data.embedding_status !== 'ready' || data.embedding === null) return null;
    return typeof data.embedding === 'string' ? JSON.parse(data.embedding) as number[] : data.embedding as unknown as number[];
  }

  public async match(candidateId: string, embedding: number[], limit: number, threshold: number): Promise<Array<{ job_id: string; similarity: number }>> {
    const { data, error } = await this.client.rpc('match_candidate_jobs', { p_candidate_id: candidateId, p_query_embedding: embedding as never, p_match_threshold: threshold, p_match_count: limit });
    if (error || !data) throw new MatchingError('VECTOR_SEARCH_FAILED', 'Vector search failed.', { cause: error });
    return data;
  }
}
