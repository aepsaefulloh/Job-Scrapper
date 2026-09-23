import { describe, expect, it, vi, afterEach } from 'vitest';
import { SumoPodProvider } from '../../../src/ai/providers/sumopod.provider.js';

afterEach(() => vi.restoreAllMocks());

describe('SumoPodProvider', () => {
  it('maps embedding requests to the OpenAI-compatible endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }), { status: 200 }));
    const provider = new SumoPodProvider({ baseUrl: 'https://api.example/v1', apiKey: 'secret' });
    await expect(provider.embed({ model: 'embed-model', input: 'hello', dimensions: 3 })).resolves.toMatchObject({ vector: [1, 2, 3], model: 'embed-model', dimensions: 3 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/v1/embeddings', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret' }) }));
  });

  it('maps non-2xx responses to a provider error without exposing response details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private upstream detail', { status: 500 }));
    const provider = new SumoPodProvider({ baseUrl: 'https://api.example/v1', apiKey: 'secret' });
    await expect(provider.embed({ model: 'embed-model', input: 'hello', dimensions: 3 })).rejects.toThrow('AI provider request failed.');
  });
});
