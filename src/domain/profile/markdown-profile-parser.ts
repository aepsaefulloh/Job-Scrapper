import { MarkdownProfileValidationError } from './profile-errors.js';
import type { NormalizedSkill, ParsedCandidateProfile } from './profile-types.js';

type SectionName = 'name' | 'headline' | 'summary' | 'experience' | 'skills' | 'careerPreferences';

const sectionByHeading = new Map<string, Exclude<SectionName, 'name'>>([
  ['headline', 'headline'],
  ['summary', 'summary'],
  ['experience', 'experience'],
  ['skills', 'skills'],
  ['career preferences', 'careerPreferences']
]);

export function parseCandidateMarkdown(markdown: string): ParsedCandidateProfile {
  const sections = collectSections(normalizeMarkdown(markdown));
  const issues: string[] = [];
  const displayName = toNarrativeText(sections.name);

  if (!displayName) {
    issues.push('missing # Name');
  }

  if (sections.skills === undefined) {
    issues.push('missing ## Skills');
  }

  const skills = sections.skills === undefined ? [] : parseSkills(sections.skills, issues);

  if (issues.length > 0) {
    throw new MarkdownProfileValidationError(issues);
  }

  return {
    displayName,
    headline: optionalNarrativeText(sections.headline),
    summary: optionalNarrativeText(sections.summary),
    experience: optionalNarrativeText(sections.experience),
    careerPreferences: optionalNarrativeText(sections.careerPreferences),
    skills
  };
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function collectSections(markdown: string): Partial<Record<SectionName, string[]>> {
  const sections: Partial<Record<SectionName, string[]>> = {};
  let activeSection: SectionName | undefined;

  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

    if (heading) {
      const headingLevel = heading[1];
      const headingText = heading[2];
      activeSection = headingLevel && headingText
        ? identifySection(headingLevel.length, headingText)
        : undefined;
      if (activeSection && !sections[activeSection]) {
        sections[activeSection] = [];
      }
      continue;
    }

    if (activeSection) {
      sections[activeSection]?.push(line);
    }
  }

  return sections;
}

function identifySection(level: number, heading: string): SectionName | undefined {
  const normalizedHeading = heading.trim().toLocaleLowerCase('en-US');

  if (level === 1 && normalizedHeading === 'name') {
    return 'name';
  }

  if (level === 2) {
    return sectionByHeading.get(normalizedHeading);
  }

  return undefined;
}

function parseSkills(lines: readonly string[], issues: string[]): NormalizedSkill[] {
  const skills = new Map<string, NormalizedSkill>();

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const match = /^-\s+(.+?)\s*$/.exec(line);
    if (!match) {
      issues.push('Skills must contain only Markdown list items');
      continue;
    }

    const capturedSkill = match[1];
    if (!capturedSkill) {
      issues.push('Skills must not contain empty list items');
      continue;
    }

    const displayName = capturedSkill.trim();
    const canonicalName = displayName.toLocaleLowerCase('en-US');

    if (!canonicalName) {
      issues.push('Skills must not contain empty list items');
      continue;
    }

    if (!skills.has(canonicalName)) {
      skills.set(canonicalName, { displayName, canonicalName });
    }
  }

  if (skills.size === 0 && !issues.includes('Skills must contain only Markdown list items')) {
    issues.push('Skills must contain at least one list item');
  }

  return [...skills.values()];
}

function optionalNarrativeText(lines: readonly string[] | undefined): string | undefined {
  const text = toNarrativeText(lines);
  return text || undefined;
}

function toNarrativeText(lines: readonly string[] | undefined): string {
  return lines?.join('\n').trim() ?? '';
}
