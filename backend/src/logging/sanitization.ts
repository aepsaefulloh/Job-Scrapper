const sensitive = /authorization|token|api[_-]?key|cookie|session|secret|password|storage[_-]?state/i;
export function sanitize(value: unknown, key = ''): unknown {
  if (sensitive.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
  return value;
}
