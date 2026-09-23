import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import { MatchingError } from './types.js';
import type { CandidateScoringInput, JobScoringInput } from './scoring/types.js';
import type { NormalizedJobSkill } from '../domain/job/job-types.js';
import { buildProfileEmbeddingText } from '../ai/embedding/profile-embedding-text.js';
import { buildJobEmbeddingText } from '../ai/embedding/job-embedding-text.js';

export interface MatchingRepository {
  getProfileEmbedding(candidateId: string): Promise<number[] | null>;
  match(candidateId: string, embedding: number[], limit: number, threshold: number): Promise<Array<{ job_id: string; similarity: number }>>;
  getCandidateContext(candidateId: string): Promise<{ text: string; scoring: CandidateScoringInput }>;
  getJobContext(candidateId: string, jobId: string): Promise<{ text: string; scoring: JobScoringInput }>;
}

export class SupabaseMatchingRepository implements MatchingRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async getProfileEmbedding(candidateId: string): Promise<number[] | null> {
    const { data, error } = await this.client.from('profiles').select('embedding, embedding_status').eq('candidate_id', candidateId).eq('is_active', true).is('deleted_at', null).single();
    if (error || !data || data.embedding_status !== 'ready' || data.embedding === null) return null;
    return typeof data.embedding === 'string' ? JSON.parse(data.embedding) as number[] : data.embedding as unknown as number[];
  }

  public async getCandidateContext(candidateId: string): Promise<{ text: string; scoring: CandidateScoringInput }> {
    const { data, error } = await this.client.from('profiles').select('display_name, headline, summary, experience, career_preferences, id').eq('candidate_id', candidateId).eq('is_active', true).is('deleted_at', null).single();
    if (error || !data) throw new MatchingError('PROFILE_CONTEXT_FAILED', 'Candidate profile context could not be loaded.', { cause: error });
    const skillsResult = await this.client.from('profile_skills').select('display_name, canonical_name').eq('profile_id', data.id);
    if (skillsResult.error) throw new MatchingError('PROFILE_CONTEXT_FAILED', 'Candidate skills could not be loaded.', { cause: skillsResult.error });
    const skills = (skillsResult.data ?? []).map((skill) => ({ displayName: skill.display_name, canonicalName: skill.canonical_name }));
    const profile = { displayName: data.display_name, headline: data.headline ?? undefined, summary: data.summary ?? undefined, experience: data.experience ?? undefined, careerPreferences: data.career_preferences ?? undefined, skills };
    return { text: buildProfileEmbeddingText(profile), scoring: { skills: skills.map((skill) => skill.canonicalName), headline: data.headline ?? undefined, preferences: { career: data.career_preferences ?? undefined } } };
  }

  public async getJobContext(candidateId: string, jobId: string): Promise<{ text: string; scoring: JobScoringInput }> {
    const { data, error } = await this.client.from('jobs').select('id, title, company_name, description, location, workplace_type').eq('candidate_id', candidateId).eq('id', jobId).is('deleted_at', null).single();
    if (error || !data) throw new MatchingError('JOB_CONTEXT_FAILED', 'Job context could not be loaded.', { cause: error });
    const skillsResult = await this.client.from('job_skills').select('display_name, canonical_name').eq('job_id', jobId).eq('candidate_id', candidateId);
    if (skillsResult.error) throw new MatchingError('JOB_CONTEXT_FAILED', 'Job skills could not be loaded.', { cause: skillsResult.error });
    const skills: NormalizedJobSkill[] = (skillsResult.data ?? []).map((skill) => ({ displayName: skill.display_name, canonicalName: skill.canonical_name, matchMethod: 'keyword' }));
    const job = { title: data.title, companyName: data.company_name, description: data.description, location: data.location ?? undefined, workplaceType: data.workplace_type ?? undefined };
    return { text: buildJobEmbeddingText(job, skills), scoring: { skills: skills.map((skill) => skill.canonicalName), title: data.title, workplaceType: data.workplace_type ?? undefined, location: data.location ?? undefined } };
  }

  public async match(candidateId: string, embedding: number[], limit: number, threshold: number): Promise<Array<{ job_id: string; similarity: number }>> {
    const { data, error } = await this.client.rpc('match_candidate_jobs', { p_candidate_id: candidateId, p_query_embedding: embedding as never, p_match_threshold: threshold, p_match_count: limit });
    if (error || !data) throw new MatchingError('VECTOR_SEARCH_FAILED', 'Vector search failed.', { cause: error });
    return data;
  }
}
