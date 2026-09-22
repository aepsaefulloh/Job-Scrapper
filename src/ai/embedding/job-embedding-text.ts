import type { NormalizedJob, NormalizedJobSkill } from '../../domain/job/job-types.js';

export function buildJobEmbeddingText(job: Partial<NormalizedJob> & Pick<NormalizedJob, 'title' | 'companyName' | 'description'>, skills: NormalizedJobSkill[]): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.companyName}`,
    `Description: ${job.description}`,
    job.location ? `Location: ${job.location}` : undefined,
    job.employmentType ? `Employment type: ${job.employmentType}` : undefined,
    job.workplaceType ? `Workplace type: ${job.workplaceType}` : undefined,
    skills.length ? `Skills: ${skills.map((skill) => skill.displayName).join(', ')}` : undefined,
  ].filter((line): line is string => Boolean(line)).join('\n').replace(/\s+/g, ' ').replace(/(Title:|Company:|Description:|Location:|Employment type:|Workplace type:|Skills:)/g, '\n$1').trim();
}
