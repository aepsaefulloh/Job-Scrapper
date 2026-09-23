import { MarkdownProfileValidationError } from './profile-errors.js';
import type { NormalizedSkill, ParsedCandidateProfile } from './profile-types.js';

type SectionName =
  | 'name'
  | 'headline'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'careerPreferences'
  | 'other';

const sectionSynonyms = new Map<string, Exclude<SectionName, 'name'>>([
  // Headline
  ['headline', 'headline'],
  ['ringkasan singkat', 'headline'],
  ['posisi', 'headline'],
  ['title', 'headline'],
  ['profesi', 'headline'],

  // Summary
  ['summary', 'summary'],
  ['profil profesional', 'summary'],
  ['ringkasan', 'summary'],
  ['ringkasan profil', 'summary'],
  ['tentang saya', 'summary'],
  ['about me', 'summary'],
  ['profile', 'summary'],
  ['profil', 'summary'],
  ['latar belakang', 'summary'],
  ['professional summary', 'summary'],
  ['personal statement', 'summary'],
  ['karakter profesional', 'summary'],

  // Experience
  ['experience', 'experience'],
  ['pengalaman kerja', 'experience'],
  ['pengalaman', 'experience'],
  ['riwayat kerja', 'experience'],
  ['work experience', 'experience'],
  ['professional experience', 'experience'],
  ['employment history', 'experience'],
  ['riwayat pengalaman', 'experience'],
  ['riwayat pekerjaan', 'experience'],

  // Education
  ['education', 'education'],
  ['pendidikan', 'education'],
  ['riwayat pendidikan', 'education'],
  ['latar belakang pendidikan', 'education'],

  // Skills
  ['skills', 'skills'],
  ['keahlian utama', 'skills'],
  ['keahlian', 'skills'],
  ['keterampilan', 'skills'],
  ['technical skills', 'skills'],
  ['core competencies', 'skills'],
  ['kompetensi', 'skills'],
  ['ai knowledge & digital productivity', 'skills'],
  ['ai knowledge', 'skills'],
  ['digital productivity', 'skills'],
  ['tools & technologies', 'skills'],
  ['tools', 'skills'],
  ['kemampuan', 'skills'],
  ['hard skills', 'skills'],
  ['soft skills', 'skills'],
  ['keahlian & kompetensi', 'skills'],

  // Career Preferences
  ['career preferences', 'careerPreferences'],
  ['preferensi karir', 'careerPreferences'],
  ['preferensi karier', 'careerPreferences'],
  ['preferensi', 'careerPreferences'],
  ['career goals', 'careerPreferences'],
  ['minat karir', 'careerPreferences'],
  ['preferensi kerja', 'careerPreferences'],
]);

type CollectedSections = {
  h1Title?: string;
  introLines: string[];
  sections: Partial<Record<SectionName, string[]>>;
};

export function parseCandidateMarkdown(markdown: string): ParsedCandidateProfile {
  const { h1Title, introLines, sections } = collectSections(normalizeMarkdown(markdown));
  const issues: string[] = [];

  let displayName = toNarrativeText(sections.name);
  if (!displayName && h1Title) {
    displayName = h1Title;
  }

  if (!displayName) {
    issues.push('missing # Name');
  }

  let headline = optionalNarrativeText(sections.headline);
  if (!headline && introLines.length > 0) {
    for (const line of introLines) {
      const trimmed = line.trim();
      const boldMatch = /^\*{2}(.+?)\*{2}$/.exec(trimmed) || /^__(.+?)__$/.exec(trimmed);
      if (boldMatch?.[1]) {
        headline = boldMatch[1].trim();
        break;
      }
    }
  }

  if (sections.skills === undefined || sections.skills.length === 0) {
    issues.push('missing ## Skills');
  }

  const skills = sections.skills === undefined ? [] : parseSkills(sections.skills, issues);

  if (issues.length > 0) {
    throw new MarkdownProfileValidationError(issues);
  }

  const experienceText = optionalNarrativeText(sections.experience);
  const educationText = optionalNarrativeText(sections.education);
  const combinedExperience = [
    experienceText,
    educationText ? `### Pendidikan\n\n${educationText}` : undefined
  ].filter(Boolean).join('\n\n') || undefined;

  return {
    displayName,
    headline,
    summary: optionalNarrativeText(sections.summary),
    experience: combinedExperience,
    careerPreferences: optionalNarrativeText(sections.careerPreferences),
    skills
  };
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function collectSections(markdown: string): CollectedSections {
  const sections: Partial<Record<SectionName, string[]>> = {};
  const introLines: string[] = [];
  let h1Title: string | undefined;
  let activeSection: SectionName | undefined;
  let hasEncounteredHeading = false;

  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

    if (heading) {
      const headingLevel = heading[1]?.length ?? 0;
      const headingText = heading[2]?.trim() ?? '';
      const normalizedHeading = headingText.toLocaleLowerCase('en-US');

      if (headingLevel === 1) {
        if (normalizedHeading === 'name' || normalizedHeading === 'nama') {
          activeSection = 'name';
        } else {
          h1Title = headingText;
          activeSection = undefined;
        }
      } else {
        const mapped = sectionSynonyms.get(normalizedHeading);
        if (mapped) {
          activeSection = mapped;
        } else if (headingLevel >= 3 && activeSection && activeSection !== 'other') {
          // Preserve sub-heading (e.g. ### Job Company under ## Experience) as section content
          sections[activeSection]?.push(line);
          continue;
        } else {
          activeSection = 'other';
        }
      }

      hasEncounteredHeading = true;
      if (activeSection && activeSection !== 'other' && !sections[activeSection]) {
        sections[activeSection] = [];
      }
      continue;

    }

    if (activeSection && activeSection !== 'other') {
      sections[activeSection]?.push(line);
    } else if (hasEncounteredHeading && h1Title && !activeSection) {
      introLines.push(line);
    }
  }

  return { h1Title, introLines, sections };
}

function parseSkills(lines: readonly string[], issues: string[]): NormalizedSkill[] {
  const skills = new Map<string, NormalizedSkill>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') {
      continue;
    }

    const match = /^[-*•]\s+(.+?)\s*$/.exec(trimmed) || /^\d+\.\s+(.+?)\s*$/.exec(trimmed);
    if (!match) {
      issues.push('Skills must contain only Markdown list items');
      continue;
    }

    const capturedSkill = match[1];
    if (!capturedSkill) {
      issues.push('Skills must not contain empty list items');
      continue;
    }

    let displayName = capturedSkill.trim();
    displayName = displayName.replace(/^(\*\*|__|\*|_)/, '').replace(/(\*\*|__|\*|_)$/, '').trim();
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

