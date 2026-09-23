import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from '../../src/config/env.js';
import { createUserSupabaseClient } from '../../src/infrastructure/supabase/supabase-user-client.js';
import { SupabaseProfileRepository } from '../../src/infrastructure/supabase/profile-repository.js';
import { SupabaseProfileDocumentStorage } from '../../src/infrastructure/supabase/profile-document-storage.js';
import { ProfileService } from '../../src/services/profile-service.js';
import { SupabaseSearchProfileRepository } from '../../src/search/search-profile.repository.js';
import { SearchProfileService } from '../../src/search/search-profile.service.js';
import { SearchPlanner } from '../../src/search/search-planner.js';
import { applyHardFilters } from '../../src/search/eligibility-filter.js';
import { JobstreetScraper } from '../../src/scraping/providers/jobstreet/jobstreet.scraper.js';
import { CamoufoxBrowserService } from '../../src/browser/camoufox.browser.js';
import { JobIngestionService } from '../../src/services/job-ingestion-service.js';
import { SupabaseJobRepository } from '../../src/infrastructure/supabase/job-repository.js';
import { SumoPodProvider } from '../../src/ai/providers/sumopod.provider.js';
import { EmbeddingService } from '../../src/ai/embedding/embedding.service.js';
import { LlmService } from '../../src/ai/completion/llm.service.js';
import { SupabaseMatchingRepository } from '../../src/matching/matching.repository.js';
import { VectorSearchService } from '../../src/matching/vector-search.service.js';
import { DefaultMatchingService } from '../../src/services/matching-service.js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('=== STARTING CONTROLLED JOBSTREET SCRAPE TEST ===');
  const env = loadEnv(process.env);

  const email = process.env.TEST_USER_A_EMAIL;
  const password = process.env.TEST_USER_A_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_A_EMAIL and TEST_USER_A_PASSWORD are required in .env');
  }

  // 1. Authenticate user
  const authClient = createClient(env.supabaseUrl, env.supabasePublishableKey);
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) {
    throw new Error('Authentication failed: ' + authError?.message);
  }

  const accessToken = authData.session.access_token;
  const candidateId = authData.user.id;
  console.log('✔ Authenticated successfully as test candidate.');

  // 2. User client
  const client = createUserSupabaseClient(accessToken, env);
  const profileRepo = new SupabaseProfileRepository(client);
  const storage = new SupabaseProfileDocumentStorage(client);
  const profileSvc = new ProfileService(storage, profileRepo);

  // 3. Ensure candidate profile exists
  let candidateProfile = await profileRepo.getActiveProfile(candidateId);
  if (!candidateProfile) {
    console.log('No active profile found. Uploading sample CV...');
    const cvPath = path.resolve(import.meta.dirname, '../../../docs/CV Rafika Devilia — Markdown.md');
    const cvContent = fs.readFileSync(cvPath, 'utf8');
    await profileSvc.upload({ candidateId, fileName: 'candidate.md', contents: cvContent });
    candidateProfile = await profileRepo.getActiveProfile(candidateId);
    if (!candidateProfile) throw new Error('Failed to create candidate profile from sample CV');
  }
  console.log(`✔ Active candidate profile loaded. Headline: "${candidateProfile.headline}"`);

  // 4. Derive search profile
  const searchRepo = new SupabaseSearchProfileRepository(client);
  const searchSvc = new SearchProfileService(searchRepo);
  const searchProfile = await searchSvc.getOrDerive(candidateId, candidateProfile);
  console.log('✔ Search Profile derived/loaded. Target roles:', searchProfile.targetRoles);

  // 5. Generate intents via SearchPlanner
  const planner = new SearchPlanner();
  const intents = planner.createIntents(searchProfile, { defaultMaxPages: 1 });
  if (intents.length === 0) throw new Error('No search intents generated from search profile');
  console.log(`✔ Planner generated ${intents.length} intents.`);

  // Pick first intent
  const selectedIntent = intents[0];
  console.log(`✔ Selected candidate-driven intent: [${selectedIntent.source}] keyword="${selectedIntent.keyword}" maxPages=${selectedIntent.maxPages}`);

  // 6. Run controlled scraper with maxPages = 1
  if (!env.camoufoxExecutablePath) throw new Error('CAMOUFOX_EXECUTABLE_PATH is missing');
  const browserService = new CamoufoxBrowserService(env.camoufoxExecutablePath);
  const scraper = new JobstreetScraper(browserService);

  console.log('Running scraper with maxPages=1...');
  const scrapeStart = Date.now();
  const scrapedJobs = await scraper.search({
    keyword: selectedIntent.keyword,
    location: selectedIntent.location,
    maxPages: 1
  });
  console.log(`✔ Discovered ${scrapedJobs.length} jobs in ${Date.now() - scrapeStart}ms.`);

  // 7. Test Hard Filter
  let eligibleCount = 0;
  let rejectedCount = 0;
  for (const job of scrapedJobs) {
    const filterResult = applyHardFilters({
      title: job.title,
      companyName: job.company ?? '',
      employmentType: job.employmentType,
      location: job.location,
    }, searchProfile);

    if (filterResult.eligible) eligibleCount++;
    else rejectedCount++;
  }
  console.log(`✔ Hard Filter evaluated: ${eligibleCount} eligible, ${rejectedCount} rejected.`);

  // 8. Ingest first eligible job (or first job)
  const jobRepo = new SupabaseJobRepository(client);
  const ingestion = new JobIngestionService(jobRepo);

  const sampleJob = scrapedJobs[0];
  if (sampleJob) {
    const rawJobInput = {
      source: sampleJob.source,
      externalId: sampleJob.externalId,
      url: sampleJob.jobUrl,
      fetchedAt: sampleJob.scrapedAt,
      payload: {
        title: sampleJob.title,
        company: sampleJob.company ?? 'Unknown',
        description: sampleJob.description ?? '',
        location: sampleJob.location,
        employmentType: sampleJob.employmentType,
        workplaceType: sampleJob.workMode,
        publishedAt: sampleJob.publishedAt,
        metadata: sampleJob.metadata
      }
    };
    const ingestResult = await ingestion.ingest(rawJobInput, candidateId);
    console.log(`✔ Ingestion completed for sample job: ID=${ingestResult.jobId} (created=${ingestResult.created}, changed=${ingestResult.changed})`);

    // 9. Embed and matching
    const provider = new SumoPodProvider({ baseUrl: env.aiBaseUrl, apiKey: env.aiApiKey });
    const matchingRepo = new SupabaseMatchingRepository(client);
    const embeddings = new EmbeddingService(provider, { model: env.aiEmbeddingModel, dimensions: env.aiEmbeddingDimensions });

    try {
      const jobContext = await matchingRepo.getJobContext(candidateId, ingestResult.jobId);
      const embedResult = await embeddings.embedText(jobContext.text);
      await client.from('jobs').update({
        embedding_status: 'ready',
        embedding: embedResult.vector as never,
        embedding_model: embedResult.model,
        embedding_dimensions: embedResult.dimensions,
        embedding_error: null,
        embedding_updated_at: new Date().toISOString()
      }).eq('candidate_id', candidateId).eq('id', ingestResult.jobId);
      console.log('✔ Job embedding generated and persisted.');

      const matchingService = new DefaultMatchingService(
        new VectorSearchService(matchingRepo, { maxLimit: 200 }),
        matchingRepo,
        new LlmService(provider),
        env.aiChatModel
      );
      const recommendations = await matchingService.recommend(candidateId, 5, 0, accessToken);
      console.log(`✔ Matching recommendation generated: ${recommendations.length} recommendations.`);
    } catch (e: any) {
      console.log(`⚠ Embedding / Matching skipped or partial: ${e.message}`);
    }
  }

  console.log('\n=== CONTROLLED SCRAPE TEST COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('Controlled scrape failed:', err);
  process.exit(1);
});
