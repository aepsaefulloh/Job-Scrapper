export type CandidateSkill = {
  displayName: string;
  canonicalName: string;
};

export type CandidateProfile = {
  id: string;
  candidateId: string;
  displayName: string;
  headline: string | null;
  summary: string | null;
  experience: string | null;
  careerPreferences: string | null;
  skills: CandidateSkill[];
  updatedAt: string;
};

export type ProfileUploadResponse = {
  documentId: string;
  profileId: string;
  checksum: string;
  uploadedAt: string;
  skillCount: number;
};

export type UpdateProfilePayload = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: string[];
};
