import { AiProviderError } from '../ai-errors.js';
import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../embedding/embedding.interface.js';
import type { CompletionProvider, CompletionRequest, CompletionResult } from '../completion/llm.interface.js';

type ProviderConfig = { baseUrl: string; apiKey: string; timeoutMs?: number };

export class SumoPodProvider implements EmbeddingProvider, CompletionProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  public constructor(private readonly config: ProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const body = await this.request('/embeddings', { model: request.model, input: request.input, dimensions: request.dimensions });
    const vector = body.data?.[0]?.embedding;
    if (!Array.isArray(vector)) throw new AiProviderError('AI provider returned no embedding.');
    return { vector, model: request.model, dimensions: vector.length };
  }

  public async complete(request: CompletionRequest): Promise<CompletionResult> {
    const body = await this.request('/chat/completions', { model: request.model, messages: request.messages, response_format: { type: 'json_object' } });
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiProviderError('AI provider returned no completion.');
    return { content };
  }

  private async request(path: string, payload: unknown): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) throw new AiProviderError('AI provider request failed.');
      return await response.json();
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('AI provider request failed.', { cause: error });
    } finally { clearTimeout(timeout); }
  }
}
