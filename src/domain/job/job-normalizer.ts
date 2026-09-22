import { JobValidationError } from './job-errors.js';
import { extractJobSkills } from './job-skills.js';
import type { NormalizedJob, NormalizedJobSkill, RawJobInput } from './job-types.js';

const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'ref', 'utm_campaign', 'utm_medium', 'utm_source', 'utm_term', 'utm_content']);

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new JobValidationError(`Job payload field '${key}' is required.`);
  }
  return value.trim().replace(/\s+/g, ' ');
}

function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().replace(/\s+/g, ' ') : undefined;
}

function optionalIsoDate(payload: Record<string, unknown>, key: string): string | undefined {
  const value = optionalString(payload, key);
  if (value === undefined) return undefined;
  if (Number.isNaN(Date.parse(value))) throw new JobValidationError(`Job payload field '${key}' must be an ISO date.`);
  return new Date(value).toISOString();
}

export function canonicalizeJobUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new JobValidationError('Job URL must be valid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new JobValidationError('Job URL must use HTTP or HTTPS.');
  [...parsed.searchParams.keys()].forEach((key) => {
    if (TRACKING_PARAMETERS.has(key.toLocaleLowerCase())) parsed.searchParams.delete(key);
  });
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString().replace(/\/$/, '');
}

export function normalizeJob(input: RawJobInput): NormalizedJob {
  if (!input.source.trim()) throw new JobValidationError('Job source is required.');
  const canonicalUrl = canonicalizeJobUrl(input.url);
  const normalized: NormalizedJob = {
    source: input.source.trim(),
    ...(input.externalId?.trim() ? { externalId: input.externalId.trim() } : {}),
    canonicalUrl,
    title: requiredString(input.payload, 'title'),
    companyName: requiredString(input.payload, 'company'),
    description: requiredString(input.payload, 'description'),
    ...(optionalString(input.payload, 'location') ? { location: optionalString(input.payload, 'location') } : {}),
    ...(optionalString(input.payload, 'employmentType') ? { employmentType: optionalString(input.payload, 'employmentType') } : {}),
    ...(optionalString(input.payload, 'workplaceType') ? { workplaceType: optionalString(input.payload, 'workplaceType') } : {}),
    ...(optionalIsoDate(input.payload, 'publishedAt') ? { publishedAt: optionalIsoDate(input.payload, 'publishedAt') } : {}),
    ...(optionalIsoDate(input.payload, 'expiresAt') ? { expiresAt: optionalIsoDate(input.payload, 'expiresAt') } : {}),
  };
  return normalized;
}

export function extractNormalizedJobSkills(job: NormalizedJob): NormalizedJobSkill[] {
  return extractJobSkills([job.title, job.description, job.companyName].join('\n'));
}
