import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.js';

export interface ProfileDocumentStorage {
  upload(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class SupabaseProfileDocumentStorage implements ProfileDocumentStorage {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async upload(path: string, contents: string): Promise<void> {
    const { error } = await this.client.storage.from('candidate-profile-documents').upload(path, contents, {
      contentType: 'text/markdown',
      upsert: false
    });
    if (error) throw new Error('Candidate profile document could not be stored.');
  }

  public async remove(path: string): Promise<void> {
    const { error } = await this.client.storage.from('candidate-profile-documents').remove([path]);
    if (error) throw new Error('Candidate profile document cleanup failed.');
  }
}
