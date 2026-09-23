import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import type { ScrapeRunRecord, ScrapeRunRepository, ScrapeRunStart } from '../../scraping/scrape-run.service.js';
import type { ScheduledJobSearch } from '../../scheduler/scheduled-scrape-task.js';

function mapToRecord(row: any): ScrapeRunRecord {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    source: row.source,
    keyword: row.keyword,
    location: row.location,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    discovered: row.discovered_count ?? 0,
    inserted: row.inserted_count ?? 0,
    updated: row.updated_count ?? 0,
    duplicates: row.duplicate_count ?? 0,
    failed: row.failed_count ?? 0,
    safeErrorCode: row.error_code,
    safeErrorMessage: row.error_message,
    trigger: row.metadata?.trigger === 'scheduled' ? 'scheduled' : 'manual',
    createdAt: row.created_at,
  };
}

export class SupabaseScrapeRunRepository implements ScrapeRunRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async start(input: ScrapeRunStart): Promise<{ id: string }> {
    const { data, error } = await (this.client as any)
      .from('scrape_runs')
      .insert({
        candidate_id: input.candidateId,
        source: input.source,
        keyword: input.keyword ?? null,
        location: input.location ?? null,
        status: 'running',
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();

    if (error || !data) throw new Error('Scrape run could not be created.');
    return { id: data.id };
  }

  public async finish(id: string, input: Parameters<ScrapeRunRepository['finish']>[1]): Promise<void> {
    const { error } = await (this.client as any)
      .from('scrape_runs')
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        discovered_count: input.discovered,
        inserted_count: input.inserted,
        updated_count: input.updated,
        duplicate_count: input.duplicates,
        failed_count: input.failed,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
      })
      .eq('id', id);

    if (error) throw new Error('Scrape run could not be completed.');
  }

  public async hasActiveRun(candidateId: string, search: ScheduledJobSearch, _identity: string): Promise<boolean> {
    let query = (this.client as any)
      .from('scrape_runs')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId)
      .eq('source', search.source)
      .eq('keyword', search.keyword)
      .in('status', ['pending', 'running']);

    query = search.location ? query.eq('location', search.location) : query.is('location', null);
    const { count, error } = await query;
    if (error) throw new Error('Active scrape runs could not be checked.');
    return (count ?? 0) > 0;
  }

  public async hasAnyActiveRun(candidateId: string): Promise<boolean> {
    const { count, error } = await (this.client as any)
      .from('scrape_runs')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId)
      .in('status', ['pending', 'running']);

    if (error) throw new Error('Active scrape runs could not be checked.');
    return (count ?? 0) > 0;
  }

  public async list(candidateId: string, limit = 10): Promise<ScrapeRunRecord[]> {
    const { data, error } = await (this.client as any)
      .from('scrape_runs')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) throw new Error('Scrape runs could not be retrieved.');
    return data.map(mapToRecord);
  }

  public async getLatest(candidateId: string): Promise<ScrapeRunRecord | null> {
    const { data, error } = await (this.client as any)
      .from('scrape_runs')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error('Latest scrape run could not be retrieved.');
    return data ? mapToRecord(data) : null;
  }

  public async getById(candidateId: string, runId: string): Promise<ScrapeRunRecord | null> {
    const { data, error } = await (this.client as any)
      .from('scrape_runs')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('id', runId)
      .maybeSingle();

    if (error) throw new Error('Scrape run could not be retrieved.');
    return data ? mapToRecord(data) : null;
  }
}
