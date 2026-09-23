export type JobSkill = {
  displayName: string;
  canonicalName: string;
};

export type JobListItem = {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string | null;
  jobUrl: string;
  publishedAt: string | null;
  createdAt: string;
  skills?: JobSkill[];
  matchScore?: number;
  applicationStatus?: string | null;
};

export type JobDetail = {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string | null;
  jobUrl: string;
  description: string;
  employmentType: string | null;
  workplaceType: string | null;
  publishedAt: string | null;
  status: 'active' | 'expired' | 'closed';
  skills: JobSkill[];
  matchScore?: number;
};

export type JobRecommendation = {
  job_id: string;
  similarity: number;
  rule_score: number;
  breakdown: {
    skillScore: number;
    titleScore: number;
    workplaceScore: number;
    locationScore: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
  ai_analysis?: {
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
  recommendation: 'strong_match' | 'potential_match' | 'low_match';
};
