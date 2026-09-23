import type { LogLevel, Logger } from './logger.interface.js';
import { sanitize } from './sanitization.js';
export class StructuredLogger implements Logger {
  public constructor(private readonly write: (level: LogLevel, metadata: Record<string, unknown>) => void = (level, metadata) => console[level](JSON.stringify(metadata))) {}
  public info(metadata: Record<string, unknown>): void { this.write('info', sanitize(metadata) as Record<string, unknown>); }
  public warn(metadata: Record<string, unknown>): void { this.write('warn', sanitize(metadata) as Record<string, unknown>); }
  public error(metadata: Record<string, unknown>): void { this.write('error', sanitize(metadata) as Record<string, unknown>); }
}
