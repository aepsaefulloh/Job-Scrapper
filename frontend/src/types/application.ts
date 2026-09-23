export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export type MaterialType = 'cover_letter' | 'introduction' | 'recruiter_answer';

export type ApplicationMaterial = {
  id: string;
  type: MaterialType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ApplicationListItem = {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string | null;
  status: ApplicationStatus;
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationDetail = ApplicationListItem & {
  job: {
    id: string;
    title: string;
    companyName: string;
    location: string | null;
    description: string;
    jobUrl: string;
  };
  materials: ApplicationMaterial[];
};
