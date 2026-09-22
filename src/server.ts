import 'dotenv/config';

import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { SupabaseProfileDocumentStorage } from './infrastructure/supabase/profile-document-storage.js';
import { SupabaseProfileRepository } from './infrastructure/supabase/profile-repository.js';
import { createUserSupabaseClient } from './infrastructure/supabase/supabase-user-client.js';
import { ProfileService } from './services/profile-service.js';

const env = loadEnv(process.env);
const app = createApp({
  profileDocumentMaxBytes: env.profileDocumentMaxBytes,
  authenticate: async (accessToken) => {
    const client = createUserSupabaseClient(accessToken, env);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Invalid access token.');
    return { userId: data.user.id, accessToken };
  },
  createProfileService: (accessToken) => {
    const client = createUserSupabaseClient(accessToken, env);
    return new ProfileService(new SupabaseProfileDocumentStorage(client), new SupabaseProfileRepository(client));
  }
});

app.listen(env.port, () => {
  console.info(`Candidate profile API listening on port ${env.port}.`);
});
