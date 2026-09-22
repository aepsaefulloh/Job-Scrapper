import { describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from '../../../src/ai/embedding/embedding.service.js';
import { EmbeddingValidationError } from '../../../src/ai/ai-errors.js';

describe('EmbeddingService', () => {
  it('rejects empty text without invoking the provider', async () => {
    const embed = vi.fn();
    const service = new EmbeddingService({ embed }, { model: 'model', dimensions: 3 });
    await expect(service.embedText('  ')).rejects.toBeInstanceOf(EmbeddingValidationError);
    expect(embed).not.toHaveBeenCalled();
  });

  it('validates provider dimensions and model', async () => {
    const service = new EmbeddingService({ embed: vi.fn().mockResolvedValue({ vector: [1, 2], model: 'other', dimensions: 2 }) }, { model: 'model', dimensions: 3 });
    await expect(service.embedText('hello')).rejects.toBeInstanceOf(EmbeddingValidationError);
  });

  it('returns a validated embedding result', async () => {
    const service = new EmbeddingService({ embed: vi.fn().mockResolvedValue({ vector: [1, 2, 3], model: 'model', dimensions: 3 }) }, { model: 'model', dimensions: 3 });
    await expect(service.embedText('hello')).resolves.toEqual({ vector: [1, 2, 3], model: 'model', dimensions: 3 });
  });
});
