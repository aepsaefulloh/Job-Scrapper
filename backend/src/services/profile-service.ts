import { createHash, randomUUID } from 'node:crypto';

import { parseCandidateMarkdown } from '../domain/profile/markdown-profile-parser.js';
import type { ProfileDocumentStorage } from '../infrastructure/supabase/profile-document-storage.js';
import type { ProfileRepository, ProfileUploadResult } from '../infrastructure/supabase/profile-repository.js';

export type UploadProfileInput = {
  candidateId: string;
  fileName: string;
  contents: string;
};

export class ProfileService {
  public constructor(
    private readonly storage: ProfileDocumentStorage,
    private readonly repository: ProfileRepository
  ) {}

  public async upload(input: UploadProfileInput): Promise<ProfileUploadResult> {
    const profile = parseCandidateMarkdown(input.contents);
    const checksum = createHash('sha256').update(input.contents, 'utf8').digest('hex');
    const storagePath = `${input.candidateId}/${randomUUID()}.md`;

    await this.storage.upload(storagePath, input.contents);
    try {
      return await this.repository.createRevision({
        candidateId: input.candidateId,
        storagePath,
        checksum,
        byteSize: Buffer.byteLength(input.contents, 'utf8'),
        parserVersion: '1',
        profile
      });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw error;
    }
  }

  public async getProfile(candidateId: string) {
    return this.repository.getActiveProfile(candidateId);
  }
}
