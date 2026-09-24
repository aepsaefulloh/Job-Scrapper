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

export type CandidateProfileDetail = {
  id: string;
  candidateId: string;
  displayName: string;
  headline: string | null;
  summary: string | null;
  experience: string | null;
  careerPreferences: string | null;
  skills: Array<{ displayName: string; canonicalName: string }>;
  updatedAt: string;
};

export type UpdateProfileInput = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: Array<{ displayName: string; canonicalName: string }>;
};

export interface ProfileRepository {
  createRevision(input: CreateProfileRevisionInput): Promise<ProfileUploadResult>;
  getActiveProfile(candidateId: string): Promise<CandidateProfileDetail | null>;
  updateActiveProfile(candidateId: string, input: UpdateProfileInput): Promise<CandidateProfileDetail>;
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

  public async getActiveProfile(candidateId: string): Promise<CandidateProfileDetail | null> {
    const { data: profile, error } = await this.client
      .from('profiles')
      .select('id, candidate_id, display_name, headline, summary, experience, career_preferences, updated_at')
      .eq('candidate_id', candidateId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error('Candidate profile could not be loaded.');
    if (!profile) return null;

    const { data: skills, error: skillsError } = await this.client
      .from('profile_skills')
      .select('display_name, canonical_name')
      .eq('profile_id', profile.id);

    if (skillsError) throw new Error('Candidate profile skills could not be loaded.');

    return {
      id: profile.id,
      candidateId: profile.candidate_id,
      displayName: profile.display_name,
      headline: profile.headline,
      summary: profile.summary,
      experience: profile.experience,
      careerPreferences: profile.career_preferences,
      skills: (skills ?? []).map((s) => ({
        displayName: s.display_name,
        canonicalName: s.canonical_name,
      })),
      updatedAt: profile.updated_at,
    };
  }

  public async updateActiveProfile(
    candidateId: string,
    input: UpdateProfileInput
  ): Promise<CandidateProfileDetail> {
    const { data: profile, error } = await this.client
      .from('profiles')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error('Candidate profile could not be loaded.');
    if (!profile) throw new Error('Active profile not found.');

    const updatePayload: Record<string, unknown> = {
      display_name: input.displayName,
      updated_at: new Date().toISOString(),
    };
    if (input.headline !== undefined) updatePayload.headline = input.headline;
    if (input.summary !== undefined) updatePayload.summary = input.summary;
    if (input.experience !== undefined) updatePayload.experience = input.experience;
    if (input.careerPreferences !== undefined) updatePayload.career_preferences = input.careerPreferences;

    const { error: updateError } = await this.client
      .from('profiles')
      .update(updatePayload as never)
      .eq('id', profile.id);

    if (updateError) throw new Error('Failed to update candidate profile.');

    if (input.skills !== undefined) {
      const { error: delError } = await this.client
        .from('profile_skills')
        .delete()
        .eq('profile_id', profile.id);

      if (delError) throw new Error('Failed to update profile skills.');

      if (input.skills.length > 0) {
        const { error: insError } = await this.client
          .from('profile_skills')
          .insert(
            input.skills.map((s) => ({
              profile_id: profile.id,
              display_name: s.displayName,
              canonical_name: s.canonicalName,
              category: null,
              proficiency: null,
            })) as never
          );

        if (insError) throw new Error('Failed to insert updated profile skills.');
      }
    }

    const updated = await this.getActiveProfile(candidateId);
    if (!updated) throw new Error('Failed to reload updated profile.');
    return updated;
  }
}
