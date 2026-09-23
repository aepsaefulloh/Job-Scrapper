export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'saved',
  'applied',
  'interview',
  'rejected',
  'offer',
] as const;

export type MaterialType = 'cover_letter' | 'introduction' | 'recruiter_answer';

export type CreateApplicationInput = {
  jobId: string;
  status?: ApplicationStatus;
  notes?: string;
  appliedAt?: string;
};

export type UpdateApplicationInput = {
  status?: ApplicationStatus;
  notes?: string;
  appliedAt?: string | null;
};

export type ApplicationJobSummary = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  source: string;
  canonicalUrl: string;
};

export type ApplicationRecord = {
  id: string;
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  notes?: string;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
  job?: ApplicationJobSummary;
};

export type GeneratedMaterial = {
  id: string;
  applicationId: string;
  candidateId: string;
  materialType: MaterialType;
  content: string;
  promptInput?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GenerateCoverLetterInput = {
  notes?: string;
};

export type GenerateIntroductionInput = {
  platform?: 'linkedin' | 'email' | 'general';
  notes?: string;
};

export type GenerateAnswerInput = {
  question: string;
  context?: string;
};
