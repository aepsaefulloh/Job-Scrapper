import type { NormalizedJobSkill } from './job-types.js';

export type JobSkillVocabularyEntry = {
  displayName: string;
  canonicalName: string;
};

export const DEFAULT_JOB_SKILL_VOCABULARY: JobSkillVocabularyEntry[] = [
  { displayName: 'TypeScript', canonicalName: 'typescript' },
  { displayName: 'JavaScript', canonicalName: 'javascript' },
  { displayName: 'Node.js', canonicalName: 'node.js' },
  { displayName: 'React', canonicalName: 'react' },
  { displayName: 'SQL', canonicalName: 'sql' },
  { displayName: 'Python', canonicalName: 'python' },
  { displayName: 'Go', canonicalName: 'go' },
];

export function extractJobSkills(
  text: string,
  vocabulary: JobSkillVocabularyEntry[] = DEFAULT_JOB_SKILL_VOCABULARY,
): NormalizedJobSkill[] {
  const normalizedText = text.toLocaleLowerCase();
  return vocabulary
    .filter((entry) => {
      const escaped = entry.displayName.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(normalizedText);
    })
    .map((entry) => ({ ...entry, matchMethod: 'keyword' as const }));
}
