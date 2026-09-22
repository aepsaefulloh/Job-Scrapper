import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = new URL('../../../supabase/migrations/', import.meta.url);

async function readCandidateProfileMigration(): Promise<string> {
  const filenames = await readdir(migrationsDirectory);
  const migrationName = filenames.find((filename) => filename.endsWith('_candidate_profile_system.sql'));

  if (!migrationName) {
    throw new Error('Candidate profile migration was not generated.');
  }

  return readFile(join(fileURLToPath(migrationsDirectory), migrationName), 'utf8');
}

describe('candidate profile migration', () => {
  it('enables RLS and enforces one active profile per candidate', async () => {
    const migration = await readCandidateProfileMigration();

    expect(migration).toContain('alter table public.candidates enable row level security;');
    expect(migration).toContain('alter table public.profile_documents enable row level security;');
    expect(migration).toContain('alter table public.profiles enable row level security;');
    expect(migration).toContain('alter table public.profile_skills enable row level security;');
    expect(migration).toContain('create unique index profiles_one_active_per_candidate');
    expect(migration).toContain('where is_active = true and deleted_at is null');
    expect(migration).not.toContain('create index profile_skills_profile_id_idx');
  });
});
