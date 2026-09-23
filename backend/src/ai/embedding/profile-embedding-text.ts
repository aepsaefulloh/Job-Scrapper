import type { ParsedCandidateProfile } from '../../domain/profile/profile-types.js';

export function buildProfileEmbeddingText(profile: ParsedCandidateProfile): string {
  const lines = [
    profile.headline ? `Role: ${profile.headline}` : undefined,
    profile.summary ? `Summary: ${profile.summary}` : undefined,
    profile.experience ? `Experience: ${profile.experience}` : undefined,
    profile.skills.length ? `Skills: ${profile.skills.map((skill) => skill.displayName).join(', ')}` : undefined,
    profile.careerPreferences ? `Career preferences: ${profile.careerPreferences}` : undefined,
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n').replace(/\s+/g, ' ').replace(/(Role:|Summary:|Experience:|Skills:|Career preferences:)/g, '\n$1').trim();
}
