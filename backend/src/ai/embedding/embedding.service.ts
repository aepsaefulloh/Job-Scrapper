import { AiProviderError, EmbeddingValidationError } from '../ai-errors.js';
import type { EmbeddingProvider, EmbeddingResult } from './embedding.interface.js';

export class EmbeddingService {
  public constructor(private readonly provider: EmbeddingProvider, private readonly config: { model: string; dimensions: number }) {}

  public async embedText(text: string): Promise<EmbeddingResult> {
    if (!text.trim()) throw new EmbeddingValidationError('Embedding text must not be empty.');
    let result: EmbeddingResult;
    try {
      result = await this.provider.embed({ model: this.config.model, input: text, dimensions: this.config.dimensions });
    } catch (error) {
      if (error instanceof EmbeddingValidationError) throw error;
      throw new AiProviderError('Embedding provider request failed.', { cause: error });
    }
    if (result.model !== this.config.model || result.dimensions !== this.config.dimensions || result.vector.length !== this.config.dimensions || result.vector.some((value) => !Number.isFinite(value))) {
      throw new EmbeddingValidationError('Embedding provider returned an incompatible vector.');
    }
    return result;
  }
}
