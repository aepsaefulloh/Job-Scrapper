export type LogLevel = 'info' | 'warn' | 'error';
export interface Logger { info(metadata: Record<string, unknown>): void; warn(metadata: Record<string, unknown>): void; error(metadata: Record<string, unknown>): void; }
