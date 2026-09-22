import type { ZodType } from 'zod';
import { AiProviderError } from '../ai-errors.js';
import type { CompletionProvider, CompletionRequest } from './llm.interface.js';

export class LlmService {
  public constructor(private readonly provider: CompletionProvider) {}

  public async completeJson<T>(request: CompletionRequest, schema: ZodType<T>): Promise<T> {
    let result;
    try { result = await this.provider.complete(request); } catch (error) { throw new AiProviderError('LLM provider request failed.', { cause: error }); }
    const content = result.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      const parsed: unknown = JSON.parse(content);
      const validated = schema.safeParse(parsed);
      if (!validated.success) throw new Error('schema');
      return validated.data;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('LLM response was invalid.', { cause: error });
    }
  }
}
