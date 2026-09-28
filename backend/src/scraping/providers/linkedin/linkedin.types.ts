export interface LinkedInJobCard {
  jobId?: string;
  title?: string;
  company?: string;
  location?: string;
  jobUrl?: string;
  postedDate?: string;
  [key: string]: unknown;
}

export interface LinkedInSearchResult {
  jobs: LinkedInJobCard[];
  isAuthWallDetected?: boolean;
}
