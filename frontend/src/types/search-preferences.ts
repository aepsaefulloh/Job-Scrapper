export type SupportedJobSource = 'jobstreet' | 'loker-id';
export type WorkModePreference = 'remote' | 'hybrid' | 'onsite';
export type EmploymentTypePreference =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'freelance';
export type UnknownDatePolicy = 'exclude' | 'allow';

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
