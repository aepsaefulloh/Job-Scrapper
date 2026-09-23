export type RetryPolicy = { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };
const transient = new Set(['NAVIGATION_TIMEOUT', 'NETWORK_ERROR', 'PAGE_LOAD_FAILED']);
export async function retryTransient<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!transient.has((error as { code?: string }).code ?? '') || attempt === policy.maxAttempts) throw error;
      const delay = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
