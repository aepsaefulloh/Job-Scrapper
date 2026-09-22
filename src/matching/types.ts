export type VectorMatch = { jobId: string; similarity: number };
export type MatchingErrorCode = 'PROFILE_EMBEDDING_NOT_READY' | 'VECTOR_SEARCH_FAILED';

export class MatchingError extends Error {
  constructor(public readonly code: MatchingErrorCode, message: string, options?: { cause?: unknown }) { super(message, options); this.name = 'MatchingError'; }
}
