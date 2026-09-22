import { createHash } from 'node:crypto';
import { buildProfileEmbeddingText } from '../ai/embedding/profile-embedding-text.js';
import type { EmbeddingService } from '../ai/embedding/embedding.service.js';
import type { ParsedCandidateProfile } from '../domain/profile/profile-types.js';

type EmbeddingUpdate = { status: 'pending' | 'ready' | 'failed'; embedding?: number[] | null; model?: string; dimensions?: number; checksum?: string; error?: string };

export class ProfileEmbeddingService {
  public constructor(private readonly embeddings: Pick<EmbeddingService, 'embedText'>, private readonly repository: { update(input: EmbeddingUpdate): Promise<void> }) {}

  public async embed(profile: ParsedCandidateProfile & { id: string }): Promise<void> {
    const text = buildProfileEmbeddingText(profile);
    const checksum = createHash('sha256').update(text).digest('hex');
    await this.repository.update({ status: 'pending', embedding: null, error: undefined });
    try {
      const result = await this.embeddings.embedText(text);
      await this.repository.update({ status: 'ready', embedding: result.vector, model: result.model, dimensions: result.dimensions, checksum });
    } catch (error) {
      await this.repository.update({ status: 'failed', embedding: null, error: 'Embedding generation failed.' });
      throw error;
    }
  }
}
