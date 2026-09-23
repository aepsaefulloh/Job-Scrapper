import { describe, expect, it } from 'vitest';

import { ProfileService } from '../../../src/services/profile-service.js';
import type { ProfileDocumentStorage } from '../../../src/infrastructure/supabase/profile-document-storage.js';
import type { ProfileRepository } from '../../../src/infrastructure/supabase/profile-repository.js';

const candidateId = '7c7550f0-7731-4a89-af84-55e2f1d47e18';
const validMarkdown = '# Name\n\nAda Lovelace\n\n## Skills\n\n- TypeScript\n- PostgreSQL';

class FakeStorage implements ProfileDocumentStorage {
  public uploadedPaths: string[] = [];
  public removedPaths: string[] = [];

  public async upload(path: string, _contents: string): Promise<void> {
    this.uploadedPaths.push(path);
  }

  public async remove(path: string): Promise<void> {
    this.removedPaths.push(path);
  }
}

class FakeRepository implements ProfileRepository {
  public calls: unknown[] = [];
  public error: Error | undefined;

  public async createRevision(input: unknown) {
    this.calls.push(input);
    if (this.error) throw this.error;
    return {
      documentId: 'document-id', profileId: 'profile-id', checksum: 'a'.repeat(64),
      uploadedAt: '2026-09-22T00:00:00.000Z', skillCount: 2
    };
  }
}

describe('ProfileService', () => {
  it('uploads source Markdown and persists its parsed revision', async () => {
    const storage = new FakeStorage();
    const repository = new FakeRepository();
    const service = new ProfileService(storage, repository);

    const result = await service.upload({ candidateId, fileName: 'candidate.md', contents: validMarkdown });

    expect(storage.uploadedPaths).toEqual([expect.stringMatching(new RegExp(`^${candidateId}/.+\\.md$`))]);
    expect(repository.calls).toHaveLength(1);
    expect(result.profileId).toBe('profile-id');
  });

  it('removes a newly uploaded object when persistence fails', async () => {
    const storage = new FakeStorage();
    const repository = new FakeRepository();
    repository.error = new Error('database unavailable');
    const service = new ProfileService(storage, repository);

    await expect(service.upload({ candidateId, fileName: 'candidate.md', contents: validMarkdown }))
      .rejects.toThrow('database unavailable');

    expect(storage.removedPaths).toEqual(storage.uploadedPaths);
  });
});
