export type EmbeddingRequest = { model: string; input: string; dimensions: number };
export type EmbeddingResult = { vector: number[]; model: string; dimensions: number };

export interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
