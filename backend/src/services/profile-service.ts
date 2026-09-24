import { createHash, randomUUID } from 'node:crypto';

import { parseCandidateMarkdown } from '../domain/profile/markdown-profile-parser.js';
import type { ProfileDocumentStorage } from '../infrastructure/supabase/profile-document-storage.js';
import type { CandidateProfileDetail, ProfileRepository, ProfileUploadResult } from '../infrastructure/supabase/profile-repository.js';
import type { SearchProfileService } from '../search/search-profile.service.js';

export type UploadProfileInput = {
  candidateId: string;
  fileName: string;
  contents: string;
};

export type UpdateProfileServiceInput = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: string[];
};

export class ProfileService {
  public constructor(
    private readonly storage: ProfileDocumentStorage,
    private readonly repository: ProfileRepository,
    private readonly searchProfileService?: Pick<SearchProfileService, 'getOrDerive'>
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

  public async updateProfile(
    candidateId: string,
    input: UpdateProfileServiceInput
  ): Promise<CandidateProfileDetail> {
    const rawSkills = input.skills ?? [];
    const skillMap = new Map<string, { displayName: string; canonicalName: string }>();

    for (const raw of rawSkills) {
      const displayName = raw.trim();
      const canonicalName = displayName.toLocaleLowerCase('en-US');
      if (canonicalName.length > 0 && !skillMap.has(canonicalName)) {
        skillMap.set(canonicalName, { displayName, canonicalName });
      }
    }

    const updated = await this.repository.updateActiveProfile(candidateId, {
      displayName: input.displayName.trim(),
      headline: input.headline !== undefined ? (input.headline ? input.headline.trim() : null) : undefined,
      summary: input.summary !== undefined ? (input.summary ? input.summary.trim() : null) : undefined,
      experience: input.experience !== undefined ? (input.experience ? input.experience.trim() : null) : undefined,
      careerPreferences: input.careerPreferences !== undefined ? (input.careerPreferences ? input.careerPreferences.trim() : null) : undefined,
      skills: input.skills !== undefined ? Array.from(skillMap.values()) : undefined,
    });

    if (this.searchProfileService) {
      try {
        await this.searchProfileService.getOrDerive(candidateId, updated);
      } catch {
        // Search profile refresh failure is non-fatal to profile update
      }
    }

    return updated;
  }
}
