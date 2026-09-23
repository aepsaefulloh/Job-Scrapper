import type { Logger } from '../logging/logger.interface.js';
type MissingEmbeddingRepository = { findJobsMissingEmbedding(candidateId: string, limit: number): Promise<Array<{ id: string }>> };
export class EmbeddingRecoveryService {
  public constructor(private readonly repository: MissingEmbeddingRepository, private readonly embedding: { embed(jobId: string): Promise<void> }, private readonly logger: Logger) {}
  public async recover(candidateId: string, limit: number): Promise<{ found: number; completed: number; failed: number }> {
    const jobs = await this.repository.findJobsMissingEmbedding(candidateId, limit); let completed = 0; let failed = 0;
    for (const job of jobs) { try { await this.embedding.embed(job.id); completed += 1; } catch { failed += 1; this.logger.warn({ event: 'embedding.recovery.failed', candidateId, jobId: job.id, errorCode: 'EMBEDDING_FAILED' }); } }
    const summary = { found: jobs.length, completed, failed }; this.logger.info({ event: 'embedding.recovery.completed', candidateId, ...summary }); return summary;
  }
}
