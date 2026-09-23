export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

export type CandidateSearchProfile = {
  candidateId: string;
  sourceProfileId?: string;
  sourceProfileUpdatedAt?: string;
  targetRoles: string[];
  roleAliases: string[];
  primarySkills: string[];
  secondarySkills: string[];
  industries: string[];
  experienceYears?: number;
  seniority: string[];
  preferredLocations: string[];
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
  excludedRoles: string[];
  excludedKeywords: string[];
  excludedCompanies: string[];
  languages: string[];
  salaryPreference?: { minimum?: number; currency?: string };
  sources: string[];
  generatedAt: string;
};

export type JobSearchIntent = {
  source: string;
  keyword: string;
  location?: string;
  maxPages?: number;
};

export type HardFilterInput = {
  title: string;
  companyName: string;
  employmentType?: string;
  expiresAt?: string;
  location?: string;
};

export type HardFilterResult =
  | { eligible: true }
  | { eligible: false; reason: string };
