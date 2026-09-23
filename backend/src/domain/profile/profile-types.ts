export type NormalizedSkill = {
  displayName: string;
  canonicalName: string;
};

export type ParsedCandidateProfile = {
  displayName: string;
  headline?: string;
  summary?: string;
  experience?: string;
  careerPreferences?: string;
  skills: NormalizedSkill[];
};
