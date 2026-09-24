import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../infrastructure/supabase/database.types.js';

export interface SearchExecutionStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  isAi?: boolean;
  startedAt?: string;
  finishedAt?: string;
  details?: string;
}

export interface SearchExecutionTimelineEvent {
  timestamp: string;
  message: string;
  isAi?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface SearchExecutionSummary {
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  filteredOut: number;
  aiEvaluated: number;
  aiFailed: number;
}

export interface SearchExecutionSource {
  source: string;
  status: string;
  discovered: number;
  inserted: number;
  duplicates: number;
  failed: number;
  durationMs?: number;
  error?: string | null;
}

export interface SearchExecutionRecord {
  id: string;
  candidateId: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  trigger: 'manual' | 'scheduled';
  startedAt: string;
  finishedAt: string | null;
  preferencesSnapshot: Record<string, unknown>;
  intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
  stages: SearchExecutionStage[];
  timeline: SearchExecutionTimelineEvent[];
  summary: SearchExecutionSummary;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  sources?: SearchExecutionSource[];
}

export interface SearchExecutionRepository {
  create(input: {
    candidateId: string;
    trigger: 'manual' | 'scheduled';
    preferencesSnapshot: Record<string, unknown>;
    intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
    initialStages: SearchExecutionStage[];
  }): Promise<SearchExecutionRecord>;
  getById(candidateId: string, id: string): Promise<SearchExecutionRecord | null>;
  list(candidateId: string, limit?: number): Promise<SearchExecutionRecord[]>;
  updateStage(
    candidateId: string,
    id: string,
    stageId: string,
    status: 'running' | 'completed' | 'failed',
    details?: string
  ): Promise<void>;
  appendTimeline(
    candidateId: string,
    id: string,
    event: { message: string; isAi?: boolean; type?: 'info' | 'success' | 'warning' | 'error' }
  ): Promise<void>;
  finish(
    candidateId: string,
    id: string,
    result: {
      status: 'completed' | 'partial' | 'failed';
      summary: SearchExecutionSummary;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void>;
}

export class SupabaseSearchExecutionRepository implements SearchExecutionRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async create(input: {
    candidateId: string;
    trigger: 'manual' | 'scheduled';
    preferencesSnapshot: Record<string, unknown>;
    intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
    initialStages: SearchExecutionStage[];
  }): Promise<SearchExecutionRecord> {
    const initialTimeline: SearchExecutionTimelineEvent[] = [
      {
        timestamp: new Date().toISOString(),
        message: 'Search execution started',
        type: 'info',
      },
    ];

    const initialSummary: SearchExecutionSummary = {
      discovered: 0,
      inserted: 0,
      updated: 0,
      duplicates: 0,
      failed: 0,
      filteredOut: 0,
      aiEvaluated: 0,
      aiFailed: 0,
    };

    const { data, error } = await this.client
      .from('search_executions')
      .insert({
        candidate_id: input.candidateId,
        trigger: input.trigger,
        status: 'running',
        preferences_snapshot: input.preferencesSnapshot as any,
        intents_snapshot: input.intentsSnapshot as any,
        stages: input.initialStages as any,
        timeline: initialTimeline as any,
        summary: initialSummary as any,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create search execution: ${error?.message || 'unknown'}`);
    }

    return this.mapRowToRecord(data as any);
  }

  public async getById(candidateId: string, id: string): Promise<SearchExecutionRecord | null> {
    const { data: execution, error: execError } = await this.client
      .from('search_executions')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('id', id)
      .maybeSingle();

    if (execError || !execution) {
      return null;
    }

    const { data: scrapeRuns } = await this.client
      .from('scrape_runs')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('search_execution_id', id)
      .order('started_at', { ascending: true });

    const sources: SearchExecutionSource[] = (scrapeRuns ?? []).map((run: any) => {
      let durationMs: number | undefined;
      if (run.started_at && run.finished_at) {
        durationMs = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
      }
      return {
        source: run.source,
        status: run.status,
        discovered: run.discovered_count,
        inserted: run.inserted_count,
        duplicates: run.duplicate_count,
        failed: run.failed_count,
        durationMs,
        error: run.error_message,
      };
    });

    const record = this.mapRowToRecord(execution as any);
    record.sources = sources;
    return record;
  }

  public async list(candidateId: string, limit = 10): Promise<SearchExecutionRecord[]> {
    const { data, error } = await this.client
      .from('search_executions')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => this.mapRowToRecord(row));
  }

  public async updateStage(
    candidateId: string,
    id: string,
    stageId: string,
    status: 'running' | 'completed' | 'failed',
    details?: string
  ): Promise<void> {
    const { data } = await this.client
      .from('search_executions')
      .select('stages')
      .eq('candidate_id', candidateId)
      .eq('id', id)
      .maybeSingle();

    if (!data) return;

    const stages: SearchExecutionStage[] = ((data as any).stages || []).map((stage: SearchExecutionStage) => {
      if (stage.id === stageId) {
        return {
          ...stage,
          status,
          ...(status === 'running' && !stage.startedAt ? { startedAt: new Date().toISOString() } : {}),
          ...(status === 'completed' || status === 'failed' ? { finishedAt: new Date().toISOString() } : {}),
          ...(details ? { details } : {}),
        };
      }
      return stage;
    });

    await this.client
      .from('search_executions')
      .update({ stages: stages as any })
      .eq('candidate_id', candidateId)
      .eq('id', id);
  }

  public async appendTimeline(
    candidateId: string,
    id: string,
    event: { message: string; isAi?: boolean; type?: 'info' | 'success' | 'warning' | 'error' }
  ): Promise<void> {
    const { data } = await this.client
      .from('search_executions')
      .select('timeline')
      .eq('candidate_id', candidateId)
      .eq('id', id)
      .maybeSingle();

    if (!data) return;

    const timeline: SearchExecutionTimelineEvent[] = [
      ...((data as any).timeline || []),
      {
        timestamp: new Date().toISOString(),
        message: event.message,
        isAi: event.isAi,
        type: event.type ?? 'info',
      },
    ];

    await this.client
      .from('search_executions')
      .update({ timeline: timeline as any })
      .eq('candidate_id', candidateId)
      .eq('id', id);
  }

  public async finish(
    candidateId: string,
    id: string,
    result: {
      status: 'completed' | 'partial' | 'failed';
      summary: SearchExecutionSummary;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await this.client
      .from('search_executions')
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        summary: result.summary as any,
        error_code: result.errorCode ?? null,
        error_message: result.errorMessage ?? null,
      })
      .eq('candidate_id', candidateId)
      .eq('id', id);
  }

  private mapRowToRecord(row: any): SearchExecutionRecord {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      status: row.status,
      trigger: row.trigger,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      preferencesSnapshot: row.preferences_snapshot || {},
      intentsSnapshot: row.intents_snapshot || [],
      stages: row.stages || [],
      timeline: row.timeline || [],
      summary: row.summary || {
        discovered: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        failed: 0,
        filteredOut: 0,
        aiEvaluated: 0,
        aiFailed: 0,
      },
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
