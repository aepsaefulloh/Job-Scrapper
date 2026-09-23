import { describe, expect, it, vi } from 'vitest';
import { StructuredLogger } from '../../../src/logging/logger.js';
describe('StructuredLogger', () => {
  it('redacts secret-like metadata before writing structured logs', () => {
    const write = vi.fn(); new StructuredLogger(write).info({ event: 'scrape.completed', authorization: 'Bearer secret', nested: { cookie: 'x', value: 'ok' } });
    expect(write).toHaveBeenCalledWith('info', expect.objectContaining({ event: 'scrape.completed', authorization: '[REDACTED]', nested: { cookie: '[REDACTED]', value: 'ok' } }));
  });
});
