import type { SupabaseClient } from '@supabase/supabase-js';

import type { ParsedCandidateProfile } from '../../domain/profile/profile-types.js';
import type { Database } from './database.types.js';

export type CreateProfileRevisionInput = {
  candidateId: string;
  storagePath: string;
  checksum: string;
  byteSize: number;
  parserVersion: string;
  profile: ParsedCandidateProfile;
};

export type ProfileUploadResult = {
  documentId: string;
  profileId: string;
  checksum: string;
  uploadedAt: string;
  skillCount: number;
};

export interface ProfileRepository {
  createRevision(input: CreateProfileRevisionInput): Promise<ProfileUploadResult>;
}

export class SupabaseProfileRepository implements ProfileRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async createRevision(input: CreateProfileRevisionInput): Promise<ProfileUploadResult> {
    const { data, error } = await this.client.rpc('create_profile_revision', {
      p_storage_path: input.storagePath,
      p_checksum: input.checksum,
      p_byte_size: input.byteSize,
      p_parser_version: input.parserVersion,
      p_display_name: input.profile.displayName,
      p_headline: input.profile.headline ?? null,
      p_summary: input.profile.summary ?? null,
      p_experience: input.profile.experience ?? null,
      p_career_preferences: input.profile.careerPreferences ?? null,
      p_skills: input.profile.skills.map((skill) => ({
        display_name: skill.displayName,
        canonical_name: skill.canonicalName,
        category: null,
        proficiency: null
      }))
    } as never).single();

    if (error || !data) throw new Error('Candidate profile revision could not be saved.');

    return {
      documentId: data.document_id,
      profileId: data.profile_id,
      checksum: data.checksum,
      uploadedAt: data.uploaded_at,
      skillCount: data.skill_count
    };
  }
}
