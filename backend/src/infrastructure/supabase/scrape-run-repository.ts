import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import type { ScrapeRunRepository, ScrapeRunStart } from '../../scraping/scrape-run.service.js';
import type { ScheduledJobSearch } from '../../scheduler/scheduled-scrape-task.js';

export class SupabaseScrapeRunRepository implements ScrapeRunRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}
  public async start(input: ScrapeRunStart): Promise<{ id: string }> {
    const { data, error } = await (this.client as any).from('scrape_runs').insert({ candidate_id: input.candidateId, source: input.source, keyword: input.keyword ?? null, location: input.location ?? null, status: 'running' }).select('id').single();
    if (error || !data) throw new Error('Scrape run could not be created.'); return { id: data.id };
  }
  public async finish(id: string, input: Parameters<ScrapeRunRepository['finish']>[1]): Promise<void> {
    const { error } = await (this.client as any).from('scrape_runs').update({ status: input.status, finished_at: new Date().toISOString(), discovered_count: input.discovered, inserted_count: input.inserted, updated_count: input.updated, duplicate_count: input.duplicates, failed_count: input.failed, error_code: input.errorCode ?? null, error_message: input.errorMessage ?? null }).eq('id', id);
    if (error) throw new Error('Scrape run could not be completed.');
  }
  public async hasActiveRun(candidateId: string, search: ScheduledJobSearch, _identity: string): Promise<boolean> {
    let query = (this.client as any).from('scrape_runs').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId).eq('source', search.source).eq('keyword', search.keyword).in('status', ['pending', 'running']);
    query = search.location ? query.eq('location', search.location) : query.is('location', null);
    const { count, error } = await query; if (error) throw new Error('Active scrape runs could not be checked.'); return (count ?? 0) > 0;
  }
}
