import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';
import {
  readyAiMatchAnalysisSchema,
  type AiMatchAnalysis,
} from './llm-evaluator.js';

export type EvaluationCacheIdentity = {
  candidateId: string;
  profileChecksum: string;
  jobChecksum: string;
  promptVersion: string;
  model: string;
};

export type ReadyAiMatchAnalysis = Extract<AiMatchAnalysis, { status: 'ready' }>;

export interface EvaluationCacheRepository {
  get(identity: EvaluationCacheIdentity): Promise<ReadyAiMatchAnalysis | null>;
  save(
    identity: EvaluationCacheIdentity,
    jobId: string,
    evaluation: ReadyAiMatchAnalysis
  ): Promise<void>;
}

export class SupabaseEvaluationCacheRepository implements EvaluationCacheRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async get(identity: EvaluationCacheIdentity): Promise<ReadyAiMatchAnalysis | null> {
    const query = this.client
      .from('ai_match_evaluations')
      .select('evaluation')
      .eq('candidate_id', identity.candidateId)
      .eq('profile_checksum', identity.profileChecksum)
      .eq('job_checksum', identity.jobChecksum)
      .eq('prompt_version', identity.promptVersion)
      .eq('model', identity.model);
    const { data, error } = await query.maybeSingle();

    if (error) throw new Error('AI evaluation cache lookup failed.', { cause: error });
    if (!data) return null;

    const parsed = readyAiMatchAnalysisSchema.safeParse(data.evaluation);
    return parsed.success ? parsed.data : null;
  }

  public async save(
    identity: EvaluationCacheIdentity,
    jobId: string,
    evaluation: ReadyAiMatchAnalysis
  ): Promise<void> {
    const { error } = await this.client.from('ai_match_evaluations').upsert(
      {
        candidate_id: identity.candidateId,
        job_id: jobId,
        profile_checksum: identity.profileChecksum,
        job_checksum: identity.jobChecksum,
        prompt_version: identity.promptVersion,
        model: identity.model,
        evaluation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'candidate_id,profile_checksum,job_checksum,prompt_version,model' }
    );

    if (error) throw new Error('AI evaluation cache save failed.', { cause: error });
  }
}
