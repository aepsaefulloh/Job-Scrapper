export type ScrapeRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface ScrapeRunRecord {
  id: string;
  candidateId: string;
  source: string;
  keyword: string | null;
  location: string | null;
  status: ScrapeRunStatus;
  startedAt: string;
  finishedAt: string | null;
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  trigger?: 'manual' | 'scheduled';
  createdAt: string;
}

export interface ScrapeRunsListResponse {
  items: ScrapeRunRecord[];
}

export interface LatestScrapeRunResponse {
  latest: ScrapeRunRecord | null;
}

export interface SearchRunTriggerResponse {
  status: 'running';
  runIds: string[];
}
