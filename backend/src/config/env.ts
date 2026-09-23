import { z } from 'zod';
import type { ScheduledJobSearch } from '../scheduler/scheduled-scrape-task.js';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const scheduledSearches = z.string().default('[]').transform((value, context) => {
  try { return JSON.parse(value) as unknown; } catch { context.addIssue({ code: 'custom', message: 'JOB_SCRAPE_SEARCHES_JSON must contain valid JSON.' }); return z.NEVER; }
}).pipe(z.array(z.object({ source: z.literal('jobstreet'), keyword: z.string().trim().min(1), location: z.string().trim().min(1).optional(), maxPages: z.number().int().min(1).max(20).optional() })).max(20));

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string({ error: 'SUPABASE_URL is required.' }).url(),
  SUPABASE_PUBLISHABLE_KEY: z.string({ error: 'SUPABASE_PUBLISHABLE_KEY is required.' }).min(1),
  PROFILE_DOCUMENT_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576),
  AI_PROVIDER: z.literal('sumopod').default('sumopod'),
  AI_API_KEY: z.string({ error: 'AI_API_KEY is required.' }).min(1),
  AI_BASE_URL: z.string({ error: 'AI_BASE_URL is required.' }).url().refine((value) => value.startsWith('https://'), { message: 'AI_BASE_URL must use HTTPS.' }),
  AI_CHAT_MODEL: z.string({ error: 'AI_CHAT_MODEL is required.' }).min(1),
  AI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().refine((value) => value === 1536, { message: 'AI_EMBEDDING_DIMENSIONS must be 1536.' }).default(1536),
  CAMOUFOX_EXECUTABLE_PATH: z.string().min(1).optional(),
  JOB_SCRAPE_ENABLED: booleanString.default(false),
  JOB_SCRAPE_CRON: z.string().min(1).default('0 7 * * *'),
  JOB_SCRAPE_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
  JOB_SCRAPE_CANDIDATE_ID: z.string().min(1).optional(),
  JOB_SCRAPE_ACCESS_TOKEN: z.string().min(1).optional(),
  JOB_SCRAPE_SEARCHES_JSON: scheduledSearches,
  JOB_EMBEDDING_RECOVERY_ENABLED: booleanString.default(false),
  JOB_EMBEDDING_RECOVERY_LIMIT: z.coerce.number().int().min(1).max(100).default(25)
});

export type AppEnv = {
  port: number;
  supabaseUrl: string;
  supabasePublishableKey: string;
  profileDocumentMaxBytes: number;
  aiProvider: 'sumopod';
  aiApiKey: string;
  aiBaseUrl: string;
  aiChatModel: string;
  aiEmbeddingModel: string;
  aiEmbeddingDimensions: number;
  camoufoxExecutablePath?: string;
  jobScrapeEnabled: boolean;
  jobScrapeCron: string;
  jobScrapeTimezone: string;
  jobScrapeCandidateId?: string;
  jobScrapeAccessToken?: string;
  scheduledJobSearches: ScheduledJobSearch[];
  jobEmbeddingRecoveryEnabled: boolean;
  jobEmbeddingRecoveryLimit: number;
};

export function loadEnv(input: NodeJS.ProcessEnv): AppEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if ((result.data.JOB_SCRAPE_ENABLED || result.data.JOB_EMBEDDING_RECOVERY_ENABLED) && (!result.data.JOB_SCRAPE_CANDIDATE_ID || !result.data.JOB_SCRAPE_ACCESS_TOKEN)) {
    throw new Error('Invalid environment configuration: JOB_SCRAPE_CANDIDATE_ID and JOB_SCRAPE_ACCESS_TOKEN are required for scheduled operations.');
  }
  if (result.data.JOB_SCRAPE_ENABLED && !result.data.CAMOUFOX_EXECUTABLE_PATH) {
    throw new Error('Invalid environment configuration: CAMOUFOX_EXECUTABLE_PATH is required when JOB_SCRAPE_ENABLED=true.');
  }

  return {
    port: result.data.PORT,
    supabaseUrl: result.data.SUPABASE_URL,
    supabasePublishableKey: result.data.SUPABASE_PUBLISHABLE_KEY,
    profileDocumentMaxBytes: result.data.PROFILE_DOCUMENT_MAX_BYTES,
    aiProvider: result.data.AI_PROVIDER,
    aiApiKey: result.data.AI_API_KEY,
    aiBaseUrl: result.data.AI_BASE_URL,
    aiChatModel: result.data.AI_CHAT_MODEL,
    aiEmbeddingModel: result.data.AI_EMBEDDING_MODEL,
    aiEmbeddingDimensions: result.data.AI_EMBEDDING_DIMENSIONS,
    camoufoxExecutablePath: result.data.CAMOUFOX_EXECUTABLE_PATH,
    jobScrapeEnabled: result.data.JOB_SCRAPE_ENABLED,
    jobScrapeCron: result.data.JOB_SCRAPE_CRON,
    jobScrapeTimezone: result.data.JOB_SCRAPE_TIMEZONE,
    jobScrapeCandidateId: result.data.JOB_SCRAPE_CANDIDATE_ID,
    jobScrapeAccessToken: result.data.JOB_SCRAPE_ACCESS_TOKEN,
    scheduledJobSearches: result.data.JOB_SCRAPE_SEARCHES_JSON,
    jobEmbeddingRecoveryEnabled: result.data.JOB_EMBEDDING_RECOVERY_ENABLED,
    jobEmbeddingRecoveryLimit: result.data.JOB_EMBEDDING_RECOVERY_LIMIT
  };
}
