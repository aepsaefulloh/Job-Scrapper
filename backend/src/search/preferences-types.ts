export const SUPPORTED_JOB_SOURCES = ['jobstreet', 'loker-id'] as const;
export type SupportedJobSource = (typeof SUPPORTED_JOB_SOURCES)[number];

export const SUPPORTED_WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export type WorkModePreference = (typeof SUPPORTED_WORK_MODES)[number];

export const SUPPORTED_EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'freelance',
] as const;
export type EmploymentTypePreference = (typeof SUPPORTED_EMPLOYMENT_TYPES)[number];

export const SUPPORTED_UNKNOWN_DATE_POLICIES = ['exclude', 'allow'] as const;
export type UnknownDatePolicy = (typeof SUPPORTED_UNKNOWN_DATE_POLICIES)[number];

export interface JobSearchPreferences {
  sources: SupportedJobSource[];
  locations: string[];
  workModes: WorkModePreference[];
  employmentTypes: EmploymentTypePreference[];
  maxPostingAgeDays: number;
  unknownPostingDatePolicy: UnknownDatePolicy;
}

export const DEFAULT_SEARCH_PREFERENCES: Readonly<JobSearchPreferences> = {
  sources: ['jobstreet', 'loker-id'],
  locations: [],
  workModes: [],
  employmentTypes: [],
  maxPostingAgeDays: 7,
  unknownPostingDatePolicy: 'exclude',
};
