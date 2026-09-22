import { createHash } from 'node:crypto';
import { buildJobEmbeddingText } from '../ai/embedding/job-embedding-text.js';
import type { EmbeddingService } from '../ai/embedding/embedding.service.js';
import type { NormalizedJob, NormalizedJobSkill } from '../domain/job/job-types.js';

type EmbeddingUpdate = { status: 'ready' | 'failed'; embedding?: number[]; model?: string; dimensions?: number; checksum?: string; error?: string };

export class JobEmbeddingService {
  public constructor(private readonly embeddings: Pick<EmbeddingService, 'embedText'>, private readonly repository: { update(input: EmbeddingUpdate): Promise<void> }) {}

  public async embed(job: Partial<NormalizedJob> & { id: string; title: string; companyName: string; description: string }, skills: NormalizedJobSkill[]): Promise<void> {
    const text = buildJobEmbeddingText(job, skills);
    const checksum = createHash('sha256').update(text).digest('hex');
    try {
      const result = await this.embeddings.embedText(text);
      await this.repository.update({ status: 'ready', embedding: result.vector, model: result.model, dimensions: result.dimensions, checksum });
    } catch (error) {
      await this.repository.update({ status: 'failed', error: 'Embedding generation failed.' });
      throw error;
    }
  }
}
