import { describe, expect, it, vi } from 'vitest';
import { EmbeddingRecoveryService } from '../../../src/services/embedding-recovery-service.js';

describe('EmbeddingRecoveryService', () => {
  it('processes a bounded missing-embedding batch and continues after one failure', async () => {
    const findJobsMissingEmbedding = vi.fn().mockResolvedValue([{ id: 'one' }, { id: 'two' }]); const embed = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('provider raw secret'));
    const service = new EmbeddingRecoveryService({ findJobsMissingEmbedding }, { embed }, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    await expect(service.recover('candidate', 25)).resolves.toEqual({ found: 2, completed: 1, failed: 1 });
    expect(findJobsMissingEmbedding).toHaveBeenCalledWith('candidate', 25); expect(embed).toHaveBeenCalledTimes(2);
  });

  it('does not leak provider errors and does not process jobs excluded by the repository', async () => {
    const entries: Record<string, unknown>[] = [];
    const logger = {
      info: (entry: Record<string, unknown>) => entries.push(entry),
      warn: (entry: Record<string, unknown>) => entries.push(entry),
      error: (entry: Record<string, unknown>) => entries.push(entry)
    };
    const embed = vi.fn().mockRejectedValue(new Error('provider response with secret-key'));
    const service = new EmbeddingRecoveryService(
      { findJobsMissingEmbedding: vi.fn().mockResolvedValue([{ id: 'missing' }]) },
      { embed },
      logger
    );

    await expect(service.recover('candidate', 1)).resolves.toEqual({ found: 1, completed: 0, failed: 1 });
    expect(embed).toHaveBeenCalledWith('missing');
    expect(JSON.stringify(entries)).not.toContain('provider response');
    expect(JSON.stringify(entries)).not.toContain('secret-key');
  });
});
