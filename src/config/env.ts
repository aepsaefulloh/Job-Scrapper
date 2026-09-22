import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string({ error: 'SUPABASE_URL is required.' }).url(),
  SUPABASE_PUBLISHABLE_KEY: z.string({ error: 'SUPABASE_PUBLISHABLE_KEY is required.' }).min(1),
  PROFILE_DOCUMENT_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576)
});

export type AppEnv = {
  port: number;
  supabaseUrl: string;
  supabasePublishableKey: string;
  profileDocumentMaxBytes: number;
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
    profileDocumentMaxBytes: result.data.PROFILE_DOCUMENT_MAX_BYTES
  };
}
