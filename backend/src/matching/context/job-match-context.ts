import type { NormalizedJob, NormalizedJobSkill } from '../../domain/job/job-types.js';

export type JobMatchContext = {
  title: string;
  company: string;
  requirements: string;
  responsibilities: string;
  skills: string[];
  experienceRequirement?: string;
  location?: string;
  employmentType?: string;
  workplaceType?: string;
};

type JobContextInput = Partial<NormalizedJob> &
  Pick<NormalizedJob, 'title' | 'companyName' | 'description'>;

const REQUIREMENT_HEADING = /^(?:requirements?|qualifications?|kualifikasi)\s*:?\s*(.*)$/i;
const RESPONSIBILITY_HEADING = /^(?:responsibilities|duties|tanggung\s+jawab)\s*:?\s*(.*)$/i;

export function buildJobMatchContext(
  job: JobContextInput,
  skills: readonly NormalizedJobSkill[]
): JobMatchContext {
  const description = stripMarkup(job.description);
  const sections = extractSections(description);
  const experienceRequirement = extractExperienceRequirement(description);

  return {
    title: compactText(job.title, 200),
    company: compactText(job.companyName, 200),
    requirements: compactText(sections.requirements, 1200),
    responsibilities: compactText(sections.responsibilities, 1200),
    skills: compactSkills(skills),
    ...(experienceRequirement ? { experienceRequirement } : {}),
    ...optionalText('location', job.location),
    ...optionalText('employmentType', job.employmentType),
    ...optionalText('workplaceType', job.workplaceType),
  };
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractSections(description: string): {
  requirements: string;
  responsibilities: string;
} {
  const requirements: string[] = [];
  const responsibilities: string[] = [];
  let active: 'requirements' | 'responsibilities' | undefined;
  let recognizedHeading = false;

  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const requirementHeading = line.match(REQUIREMENT_HEADING);
    if (requirementHeading) {
      recognizedHeading = true;
      active = 'requirements';
      if (requirementHeading[1]) requirements.push(requirementHeading[1]);
      continue;
    }

    const responsibilityHeading = line.match(RESPONSIBILITY_HEADING);
    if (responsibilityHeading) {
      recognizedHeading = true;
      active = 'responsibilities';
      if (responsibilityHeading[1]) responsibilities.push(responsibilityHeading[1]);
      continue;
    }

    if (active === 'requirements') requirements.push(line);
    if (active === 'responsibilities') responsibilities.push(line);
  }

  if (!recognizedHeading) {
    return { requirements: '', responsibilities: description };
  }

  return {
    requirements: requirements.join(' '),
    responsibilities: responsibilities.join(' '),
  };
}

function extractExperienceRequirement(description: string): string | undefined {
  const text = compactText(description, 10_000);
  const sentence = text.match(
    /[^.!?]*(?:\b\d+\s*\+?\s*(?:years?|tahun)\b|\b(?:experience|pengalaman)\b)[^.!?]*[.!?]?/i
  )?.[0];
  return sentence ? compactText(sentence, 240) : undefined;
}

function compactSkills(skills: readonly NormalizedJobSkill[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const skill of skills) {
    const value = compactText(skill.canonicalName, 100);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length === 40) break;
  }

  return result;
}

function compactText(value: string, limit: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function optionalText<Key extends 'location' | 'employmentType' | 'workplaceType'>(
  key: Key,
  value: string | undefined
): Partial<Record<Key, string>> {
  const compact = value ? compactText(value, 200) : '';
  return compact ? { [key]: compact } as Record<Key, string> : {};
}
