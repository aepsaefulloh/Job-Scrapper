export type RawJobInput = {
  source: string;
  externalId?: string;
  url: string;
  fetchedAt: string;
  payload: Record<string, unknown>;
};

export type NormalizedJob = {
  source: string;
  externalId?: string;
  canonicalUrl: string;
  title: string;
  companyName: string;
  description: string;
  location?: string;
  employmentType?: string;
  workplaceType?: string;
  publishedAt?: string;
  expiresAt?: string;
};

export type NormalizedJobSkill = {
  displayName: string;
  canonicalName: string;
  matchMethod: 'keyword';
};

export type JobIngestionRecord = {
  candidateId: string;
  raw: RawJobInput & { canonicalUrl: string; payloadChecksum: string };
  normalized: NormalizedJob & { contentChecksum: string };
  skills: NormalizedJobSkill[];
};

export type JobIngestionResult = {
  rawId: string;
  jobId: string;
  changed: boolean;
};
