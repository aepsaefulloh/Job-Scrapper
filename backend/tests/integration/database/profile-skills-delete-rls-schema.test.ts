import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260924095730_add_profile_skills_delete_policy.sql'),
  'utf8'
);

describe('profile skills delete RLS migration', () => {
  it('allows an authenticated candidate to delete skills only for their own profile', () => {
    expect(migration).toContain('grant delete on public.profile_skills to authenticated');
    expect(migration).toContain('on public.profile_skills for delete to authenticated');
    expect(migration).toContain('profiles.id = profile_skills.profile_id');
    expect(migration).toContain('profiles.candidate_id = (select auth.uid())');
  });
});
