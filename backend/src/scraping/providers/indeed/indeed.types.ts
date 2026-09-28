export interface IndeedJobCard {
  jobkey?: string;
  title?: string;
  company?: string;
  location?: string;
  salaryText?: string;
  formattedRelativeTime?: string;
  viewJobLink?: string;
  [key: string]: unknown;
}

export interface IndeedSearchResult {
  jobs: IndeedJobCard[];
  isChallengeDetected?: boolean;
}
