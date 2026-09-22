import { z } from 'zod';

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
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().refine((value) => value === 1536, { message: 'AI_EMBEDDING_DIMENSIONS must be 1536.' }).default(1536)
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
};

export function loadEnv(input: NodeJS.ProcessEnv): AppEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
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
    aiEmbeddingDimensions: result.data.AI_EMBEDDING_DIMENSIONS
  };
}
