import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AppEnv } from '../../config/env.js';
import type { Database } from './database.types.js';

export function createUserSupabaseClient(accessToken: string, env: AppEnv): SupabaseClient<Database> {
  return createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}
