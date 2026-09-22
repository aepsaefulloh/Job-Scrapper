import type { RawJobInput } from './job-types.js';

export interface JobSourceAdapter {
  sourceName: string;
  collect(): AsyncIterable<RawJobInput>;
}

export function isJobSourceAdapter(value: unknown): value is JobSourceAdapter {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<JobSourceAdapter>;
  return typeof candidate.sourceName === 'string' && candidate.sourceName.trim().length > 0 && typeof candidate.collect === 'function';
}
