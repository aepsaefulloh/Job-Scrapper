import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LlmService } from '../../../src/ai/completion/llm.service.js';

const schema = z.object({ answer: z.string() });

describe('LlmService', () => {
  it('parses fenced JSON and validates the response', async () => {
    const service = new LlmService({ complete: vi.fn().mockResolvedValue({ content: '```json\n{"answer":"ok"}\n```' }) });
    await expect(service.completeJson({ model: 'chat', messages: [{ role: 'user', content: 'Hi' }] }, schema)).resolves.toEqual({ answer: 'ok' });
  });

  it('returns a typed failure for malformed JSON', async () => {
    const service = new LlmService({ complete: vi.fn().mockResolvedValue({ content: '{bad' }) });
    await expect(service.completeJson({ model: 'chat', messages: [{ role: 'user', content: 'Hi' }] }, schema)).rejects.toThrow('LLM response was invalid.');
  });
});
