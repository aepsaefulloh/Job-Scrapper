import 'dotenv/config';
import { loadEnv } from '../../src/config/env.js';
import { createUserSupabaseClient } from '../../src/infrastructure/supabase/supabase-user-client.js';
import { SupabaseProfileRepository } from '../../src/infrastructure/supabase/profile-repository.js';
import { SupabaseSearchProfileRepository } from '../../src/search/search-profile.repository.js';
import { SearchProfileService } from '../../src/search/search-profile.service.js';
import { SearchPlanner } from '../../src/search/search-planner.js';
import { DeallsScraper } from '../../src/scraping/providers/dealls/dealls.scraper.js';
import { GlintsScraper } from '../../src/scraping/providers/glints/glints.scraper.js';
import { CamoufoxBrowserService } from '../../src/browser/camoufox.browser.js';
import { ScraperOrchestrator } from '../../src/scraping/scraper.orchestrator.js';
import { JobIngestionService } from '../../src/services/job-ingestion-service.js';
import { SupabaseJobRepository } from '../../src/infrastructure/supabase/job-repository.js';
import { SupabaseScrapeRunRepository } from '../../src/infrastructure/supabase/scrape-run-repository.js';
import { SumoPodProvider } from '../../src/ai/providers/sumopod.provider.js';
import { EmbeddingService } from '../../src/ai/embedding/embedding.service.js';
import { SupabaseMatchingRepository } from '../../src/matching/matching.repository.js';
import { StructuredLogger } from '../../src/logging/logger.js';

async function main() {
  const env = loadEnv(process.env);
  const logger = new StructuredLogger();

  const email = process.env.TEST_USER_A_EMAIL;
  const password = process.env.TEST_USER_A_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_A_EMAIL and TEST_USER_A_PASSWORD must be set in .env');
  }

  console.log(`Authenticating test user: ${email}...`);
  const anonClient = createUserSupabaseClient(env.supabaseAnonKey, env);
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }

  const accessToken = authData.session.access_token;
  const candidateId = authData.user.id;
  console.log(`Authenticated as candidate: ${candidateId}`);

  const userClient = createUserSupabaseClient(accessToken, env);
  const profileRepo = new SupabaseProfileRepository(userClient);
  const searchProfileRepo = new SupabaseSearchProfileRepository(userClient);
  const searchProfileService = new SearchProfileService(searchProfileRepo);
  const searchPlanner = new SearchPlanner();

  // 1. Get candidate profile
  const candidateProfile = await profileRepo.getActiveProfile(candidateId);
  if (!candidateProfile) {
    throw new Error('Candidate has no active profile. Upload a profile first.');
  }
  console.log(`Candidate headline: "${candidateProfile.headline}"`);

  // 2. Derive Search Profile
  const searchProfile = await searchProfileService.getOrDerive(candidateId, candidateProfile);
  console.log(`Candidate target roles:`, searchProfile.targetRoles);

  // 3. Search Planner generates candidate intents for Dealls and Glints
  const planInput = {
    searchProfile: {
      ...searchProfile,
      sources: ['dealls', 'glints'],
    },
  };
  const intents = searchPlanner.createIntents(planInput, { defaultMaxPages: 1 });
  const deallsIntent = intents.find((i) => i.source === 'dealls');
  const glintsIntent = intents.find((i) => i.source === 'glints');

  console.log('Selected Dealls Intent:', deallsIntent);
  console.log('Selected Glints Intent:', glintsIntent);

  if (!deallsIntent || !glintsIntent) {
    throw new Error('Failed to generate intents for Dealls and Glints.');
  }

  // 4. Setup Scraper and Pipeline
  if (!env.camoufoxExecutablePath) {
    throw new Error('CAMOUFOX_EXECUTABLE_PATH is required.');
  }

  const provider = new SumoPodProvider({ baseUrl: env.aiBaseUrl, apiKey: env.aiApiKey });
  const matchingRepo = new SupabaseMatchingRepository(userClient);
  const embeddings = new EmbeddingService(provider, {
    model: env.aiEmbeddingModel,
    dimensions: env.aiEmbeddingDimensions,
  });

  const embeddingRunner = {
    embed: async (jobId: string) => {
      console.log(`Generating embedding for job: ${jobId}...`);
      const jobContext = await matchingRepo.getJobContext(candidateId, jobId);
      const result = await embeddings.embedText(jobContext.text);
      const { error } = await userClient
        .from('jobs')
        .update({
          embedding_status: 'ready',
          embedding: result.vector as never,
          embedding_model: result.model,
          embedding_dimensions: result.dimensions,
          embedding_error: null,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('candidate_id', candidateId)
        .eq('id', jobId);
      if (error) throw new Error(`Embedding update failed: ${error.message}`);
      console.log(`Embedding successfully stored for job: ${jobId}`);
    },
  };

  const deallsScraper = new DeallsScraper(
    new CamoufoxBrowserService(env.camoufoxExecutablePath),
    undefined,
    logger
  );
  const glintsScraper = new GlintsScraper(
    new CamoufoxBrowserService(env.camoufoxExecutablePath),
    undefined,
    logger
  );

  const jobRepo = new SupabaseJobRepository(userClient);
  const ingestion = new JobIngestionService(jobRepo);
  const scrapeRunRepo = new SupabaseScrapeRunRepository(userClient);

  const orchestrator = new ScraperOrchestrator(
    [deallsScraper, glintsScraper],
    ingestion,
    embeddingRunner,
    logger
  );

  const testSources = [deallsIntent, glintsIntent];
  for (const intent of testSources) {
    console.log(`\n========================================`);
    console.log(`Starting controlled scrape for ${intent.source.toUpperCase()}:`);
    console.log(`Keyword: "${intent.keyword}", MaxPages: ${intent.maxPages}`);
    console.log(`========================================`);

    const run = await scrapeRunRepo.start({
      candidateId,
      source: intent.source,
      keyword: intent.keyword,
      location: intent.location,
      metadata: { trigger: 'smoke-test' },
    });

    try {
      const summary = await orchestrator.run({
        candidateId,
        source: intent.source,
        query: {
          keyword: intent.keyword,
          location: intent.location,
          maxPages: 1,
          detailLimit: 1,
        },
        freshness: {
          maxPostingAgeDays: 7,
          unknownPostingDatePolicy: 'exclude',
        },
      });

      console.log(`${intent.source.toUpperCase()} Run Summary:`, summary);

      await scrapeRunRepo.finish(run.id, {
        status: summary.failed > 0 && summary.inserted === 0 ? 'failed' : 'completed',
        discovered: summary.discovered,
        inserted: summary.inserted,
        updated: summary.updated,
        duplicates: summary.duplicates,
        failed: summary.failed,
      });

      console.log(`${intent.source.toUpperCase()} Scrape run finalized successfully.`);
    } catch (err: any) {
      console.error(`${intent.source.toUpperCase()} Scrape run failed:`, err.message);
      await scrapeRunRepo.finish(run.id, {
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  console.log('\n========================================');
  console.log('Controlled Multi-Source Smoke Test Finished!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});
