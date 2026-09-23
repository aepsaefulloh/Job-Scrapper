import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { createApp } from './app.js';
import { EmbeddingService } from './ai/embedding/embedding.service.js';
import { LlmService } from './ai/completion/llm.service.js';
import { SumoPodProvider } from './ai/providers/sumopod.provider.js';
import { CamoufoxBrowserService } from './browser/camoufox.browser.js';
import { loadEnv } from './config/env.js';
import { SupabaseJobRepository } from './infrastructure/supabase/job-repository.js';
import { SupabaseProfileDocumentStorage } from './infrastructure/supabase/profile-document-storage.js';
import { SupabaseProfileRepository } from './infrastructure/supabase/profile-repository.js';
import { SupabaseScrapeRunRepository } from './infrastructure/supabase/scrape-run-repository.js';
import { createUserSupabaseClient } from './infrastructure/supabase/supabase-user-client.js';
import { StructuredLogger } from './logging/logger.js';
import { SupabaseMatchingRepository } from './matching/matching.repository.js';
import { VectorSearchService } from './matching/vector-search.service.js';
import { NodeCronDriver } from './scheduler/node-cron.driver.js';
import { SchedulerService } from './scheduler/scheduler.service.js';
import { ScheduledScrapeTask } from './scheduler/scheduled-scrape-task.js';
import { JobstreetScraper } from './scraping/providers/jobstreet/jobstreet.scraper.js';
import { ApplicationAssistantService } from './ai/assistant/application-assistant.service.js';
import { SupabaseApplicationRepository } from './infrastructure/supabase/application-repository.js';
import { ApplicationService } from './services/application-service.js';
import { ScrapeRunService } from './scraping/scrape-run.service.js';
import { ScraperOrchestrator } from './scraping/scraper.orchestrator.js';
import { EmbeddingRecoveryService } from './services/embedding-recovery-service.js';
import { JobIngestionService } from './services/job-ingestion-service.js';
import { JobService } from './services/job-service.js';
import { DefaultMatchingService } from './services/matching-service.js';
import { ProfileService } from './services/profile-service.js';
import { SearchProfileService } from './search/search-profile.service.js';
import { SupabaseSearchProfileRepository } from './search/search-profile.repository.js';

const env = loadEnv(process.env); const logger = new StructuredLogger();
function createEmbeddingRunner(accessToken: string, candidateId: string) {
  const client = createUserSupabaseClient(accessToken, env); const provider = new SumoPodProvider({ baseUrl: env.aiBaseUrl, apiKey: env.aiApiKey }); const matching = new SupabaseMatchingRepository(client); const embeddings = new EmbeddingService(provider, { model: env.aiEmbeddingModel, dimensions: env.aiEmbeddingDimensions });
  return { embed: async (jobId: string) => { const job = await matching.getJobContext(candidateId, jobId); const result = await embeddings.embedText(job.text); const { error } = await client.from('jobs').update({ embedding_status: 'ready', embedding: result.vector as never, embedding_model: result.model, embedding_dimensions: result.dimensions, embedding_error: null, embedding_updated_at: new Date().toISOString() }).eq('candidate_id', candidateId).eq('id', jobId); if (error) throw new Error('Job embedding could not be persisted.'); } };
}
async function executeScrape(input: { candidateId: string; source: string; keyword?: string; location?: string; remote?: boolean; maxPages?: number }, accessToken: string) {
  if (!env.camoufoxExecutablePath) throw new Error('CAMOUFOX_EXECUTABLE_PATH is required for scraping.');
  const client = createUserSupabaseClient(accessToken, env); const embedding = createEmbeddingRunner(accessToken, input.candidateId); const orchestrator = new ScraperOrchestrator([new JobstreetScraper(new CamoufoxBrowserService(env.camoufoxExecutablePath))], new JobIngestionService(new SupabaseJobRepository(client)), embedding, logger);
  return new ScrapeRunService(new SupabaseScrapeRunRepository(client)).execute({ candidateId: input.candidateId, source: input.source, keyword: input.keyword, location: input.location }, () => orchestrator.run({ candidateId: input.candidateId, source: input.source, query: { keyword: input.keyword, location: input.location, remote: input.remote, maxPages: input.maxPages } }));
}
const defaultStaticDir = path.resolve(import.meta.dirname, '../../frontend/dist');
const staticDir = process.env.STATIC_DIR || (fs.existsSync(defaultStaticDir) ? defaultStaticDir : undefined);

const app = createApp({
  staticDir,
  profileDocumentMaxBytes: env.profileDocumentMaxBytes, logger,
  authenticate: async (accessToken) => { const client = createUserSupabaseClient(accessToken, env); const { data, error } = await client.auth.getUser(); if (error || !data.user) throw new Error('Invalid access token.'); return { userId: data.user.id, accessToken }; },
  createProfileService: (accessToken) => { const client = createUserSupabaseClient(accessToken, env); return new ProfileService(new SupabaseProfileDocumentStorage(client), new SupabaseProfileRepository(client)); },
  createMatchingService: (accessToken) => { const client = createUserSupabaseClient(accessToken, env); const provider = new SumoPodProvider({ baseUrl: env.aiBaseUrl, apiKey: env.aiApiKey }); const repository = new SupabaseMatchingRepository(client); return new DefaultMatchingService(new VectorSearchService(repository, { maxLimit: 200 }), repository, new LlmService(provider), env.aiChatModel); },
  createJobService: (accessToken) => new JobService(new SupabaseJobRepository(createUserSupabaseClient(accessToken, env))), createJobIngestionService: (accessToken) => new JobIngestionService(new SupabaseJobRepository(createUserSupabaseClient(accessToken, env))), createJobEmbeddingService: createEmbeddingRunner, jobService: { scrape: executeScrape },
  createApplicationService: (accessToken) => {
    const client = createUserSupabaseClient(accessToken, env);
    const provider = new SumoPodProvider({ baseUrl: env.aiBaseUrl, apiKey: env.aiApiKey });
    const matchingRepo = new SupabaseMatchingRepository(client);
    const assistant = new ApplicationAssistantService(new LlmService(provider), env.aiChatModel);
    return new ApplicationService(new SupabaseApplicationRepository(client), matchingRepo, assistant, logger);
  },
  createSearchProfileService: (accessToken) => {
    const client = createUserSupabaseClient(accessToken, env);
    return new SearchProfileService(new SupabaseSearchProfileRepository(client));
  },
});
const scheduler = new SchedulerService(new NodeCronDriver(), logger); const scheduledEnabled = env.jobScrapeEnabled || env.jobEmbeddingRecoveryEnabled;
if (scheduledEnabled) {
  const candidateId = env.jobScrapeCandidateId!; const accessToken = env.jobScrapeAccessToken!; const client = createUserSupabaseClient(accessToken, env); const scrapeTask = new ScheduledScrapeTask(new SupabaseScrapeRunRepository(client), (id, search) => executeScrape({ candidateId: id, ...search }, accessToken), logger); const recovery = new EmbeddingRecoveryService(new SupabaseJobRepository(client), createEmbeddingRunner(accessToken, candidateId), logger);
  scheduler.start({ enabled: true, cron: env.jobScrapeCron, timezone: env.jobScrapeTimezone, candidateId, searches: env.scheduledJobSearches }, async (id, searches) => { if (env.jobScrapeEnabled) for (const search of searches) { try { await scrapeTask.run(id, search); } catch {} } if (env.jobEmbeddingRecoveryEnabled) try { await recovery.recover(id, env.jobEmbeddingRecoveryLimit); } catch { logger.error({ event: 'embedding.recovery.failed', candidateId: id, errorCode: 'RECOVERY_BATCH_FAILED' }); } });
} else scheduler.start({ enabled: false, cron: env.jobScrapeCron, timezone: env.jobScrapeTimezone, candidateId: '', searches: [] }, async () => undefined);
const server = app.listen(env.port, () => logger.info({ event: 'server.started', port: env.port }));
function shutdown(): void { scheduler.stop(); server.close(); }
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
