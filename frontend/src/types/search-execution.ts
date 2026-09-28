export type SearchExecutionStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface SearchExecutionStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  isAi?: boolean;
  startedAt?: string;
  finishedAt?: string;
  details?: string;
}

export interface SearchExecutionTimelineEvent {
  timestamp: string;
  message: string;
  isAi?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface SearchExecutionSummary {
  discovered: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  filteredOut: number;
  afterDeterministicFilters?: number;
  consideredForMatching?: number;
  sentToLlm?: number;
  aiCacheHits?: number;
  aiCacheMisses?: number;
  recommendationsProduced?: number;
  aiEvaluated: number;
  aiFailed: number;
}

export interface SearchExecutionSource {
  source: string;
  status: string;
  discovered: number;
  inserted: number;
  duplicates: number;
  failed: number;
  durationMs?: number;
  error?: string | null;
}

export interface SearchExecutionRecord {
  id: string;
  candidateId: string;
  status: SearchExecutionStatus;
  trigger: 'manual' | 'scheduled';
  startedAt: string;
  finishedAt: string | null;
  preferencesSnapshot: Record<string, unknown>;
  intentsSnapshot: Array<{ source: string; keyword: string; location?: string }>;
  stages: SearchExecutionStage[];
  timeline: SearchExecutionTimelineEvent[];
  summary: SearchExecutionSummary;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  sources?: SearchExecutionSource[];
}

export interface SearchExecutionPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface SearchExecutionsListResponse {
  items: SearchExecutionRecord[];
  pagination: SearchExecutionPagination;
}

export interface SearchExecutionFilters {
  status?: string;
  source?: string;
  trigger?: 'manual' | 'scheduled' | '';
  dateRange?: 'all' | 'today' | '7d' | '30d';
}

