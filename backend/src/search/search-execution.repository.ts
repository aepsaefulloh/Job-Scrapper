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

export interface SearchExecutionJobResult {
  jobId: string;
  title: string;
  company: string;
  source: string;
  location?: string;
  jobUrl?: string;
  publishedAt?: string;
  score?: number;
  recommendation?: string;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
}

export interface SearchExecutionSummary {
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  filteredOut: number;
  afterDeterministicFilters?: number;
  consideredForMatching?: number;
  sentToLlm?: number;
  aiCacheHits?: number;
  aiCacheMisses?: number;
  recommendationsProduced?: number;
  aiEvaluated: number;
  aiFailed: number;
  results?: SearchExecutionJobResult[];
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
  results?: SearchExecutionJobResult[];
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  sources?: SearchExecutionSource[];
}

export interface SearchExecutionListOptions {
  limit?: number;
  offset?: number;
  status?: string;
  source?: string;
  trigger?: 'manual' | 'scheduled';
  from?: string;
  to?: string;
}

export interface SearchExecutionListResult {
  items: SearchExecutionRecord[];
  total: number;
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
  list(candidateId: string, options?: SearchExecutionListOptions | number): Promise<SearchExecutionListResult>;
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
  delete(candidateId: string, id: string): Promise<boolean>;
  clear(candidateId: string): Promise<number>;
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

  public async list(candidateId: string, options?: SearchExecutionListOptions | number): Promise<SearchExecutionListResult> {
    const opts: SearchExecutionListOptions = typeof options === 'number' ? { limit: options } : options || {};
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);

    let query: any = this.client
      .from('search_executions')
      .select('*', { count: 'exact' })
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (opts.status) {
      query = query.eq('status', opts.status);
    }
    if (opts.trigger) {
      query = query.eq('trigger', opts.trigger);
    }
    if (opts.from) {
      query = query.gte('created_at', opts.from);
    }
    if (opts.to) {
      query = query.lte('created_at', opts.to);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error || !data || data.length === 0) {
      return { items: [], total: count ?? 0 };
    }

    const executionIds = data.map((row: any) => row.id);
    const { data: scrapeRuns } = await this.client
      .from('scrape_runs')
      .select('*')
      .eq('candidate_id', candidateId)
      .in('search_execution_id', executionIds)
      .order('started_at', { ascending: true });

    const runsByExecutionId = new Map<string, any[]>();
    for (const run of scrapeRuns ?? []) {
      const execId = (run as any).search_execution_id;
      if (!runsByExecutionId.has(execId)) {
        runsByExecutionId.set(execId, []);
      }
      runsByExecutionId.get(execId)!.push(run);
    }

    let items = data.map((row: any) => {
      const record = this.mapRowToRecord(row);
      const runs = runsByExecutionId.get(row.id) ?? [];
      record.sources = runs.map((run: any) => {
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
      return record;
    });

    if (opts.source) {
      const srcFilter = opts.source.toLowerCase();
      items = items.filter((item: SearchExecutionRecord) => {
        const hasInSources = item.sources?.some((s: SearchExecutionSource) => s.source.toLowerCase() === srcFilter);
        const prefsSources = (item.preferencesSnapshot?.sources as string[] | undefined) ?? [];
        const hasInPrefs = prefsSources.some((s: string) => s.toLowerCase() === srcFilter);
        return hasInSources || hasInPrefs;
      });
    }

    return {
      items,
      total: count ?? items.length,
    };
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

  public async delete(candidateId: string, id: string): Promise<boolean> {
    await this.client
      .from('scrape_runs')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('search_execution_id', id);

    const { error, count } = await this.client
      .from('search_executions')
      .delete({ count: 'exact' })
      .eq('candidate_id', candidateId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete search execution: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  public async clear(candidateId: string): Promise<number> {
    await this.client
      .from('scrape_runs')
      .delete()
      .eq('candidate_id', candidateId)
      .not('search_execution_id', 'is', null);

    const { error, count } = await this.client
      .from('search_executions')
      .delete({ count: 'exact' })
      .eq('candidate_id', candidateId);

    if (error) {
      throw new Error(`Failed to clear search executions: ${error.message}`);
    }

    return count ?? 0;
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
      results: (row.summary as any)?.results || [],
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
