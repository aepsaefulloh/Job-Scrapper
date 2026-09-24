import type { MatchingRepository } from './matching.repository.js';
import { MatchingError, type VectorMatch } from './types.js';

export class VectorSearchService {
  public constructor(private readonly repository: Pick<MatchingRepository, 'getProfileEmbedding' | 'match' | 'matchSubset'>, private readonly config: { maxLimit: number }) {}

  public async search(candidateId: string, requestedLimit: number, threshold: number): Promise<VectorMatch[]> {
    this.validateSearch(requestedLimit, threshold);
    const embedding = await this.repository.getProfileEmbedding(candidateId);
    if (!embedding) throw new MatchingError('PROFILE_EMBEDDING_NOT_READY', 'Candidate profile embedding is not ready.');
    const limit = Math.min(requestedLimit, this.config.maxLimit, 200);
    try {
      const rows = await this.repository.match(candidateId, embedding, limit, threshold);
      return rows.map((row) => ({ jobId: row.job_id, similarity: row.similarity }));
    } catch (error) {
      if (error instanceof MatchingError) throw error;
      throw new MatchingError('VECTOR_SEARCH_FAILED', 'Vector search failed.', { cause: error });
    }
  }

  public async searchSubset(
    candidateId: string,
    jobIds: string[],
    requestedLimit: number,
    threshold: number
  ): Promise<VectorMatch[]> {
    this.validateSearch(requestedLimit, threshold);
    const uniqueJobIds = [...new Set(jobIds)];
    if (uniqueJobIds.length === 0) return [];

    const embedding = await this.repository.getProfileEmbedding(candidateId);
    if (!embedding) throw new MatchingError('PROFILE_EMBEDDING_NOT_READY', 'Candidate profile embedding is not ready.');
    const limit = Math.min(requestedLimit, this.config.maxLimit, 200);

    try {
      const rows = await this.repository.matchSubset(
        candidateId,
        embedding,
        uniqueJobIds,
        limit,
        threshold
      );
      return rows.map((row) => ({ jobId: row.job_id, similarity: row.similarity }));
    } catch (error) {
      if (error instanceof MatchingError) throw error;
      throw new MatchingError('VECTOR_SEARCH_FAILED', 'Subset vector search failed.', { cause: error });
    }
  }

  private validateSearch(requestedLimit: number, threshold: number): void {
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new MatchingError('VECTOR_SEARCH_FAILED', 'Search limit must be a positive integer.');
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new MatchingError('VECTOR_SEARCH_FAILED', 'Similarity threshold must be between -1 and 1.');
  }
}
