import type { Logger } from '../logging/logger.interface.js';
import type { ScheduledJobSearch } from './scheduled-scrape-task.js';

export type SchedulerConfig = { enabled: boolean; cron: string; timezone: string; candidateId: string; searches: ScheduledJobSearch[] };
export type SchedulerDriver = { schedule(cron: string, task: () => Promise<void>, timezone: string): { stop(): void } };
export class SchedulerService {
  private scheduled?: { stop(): void };
  public constructor(private readonly driver: SchedulerDriver, private readonly logger: Logger) {}
  public start(config: SchedulerConfig, tick: (candidateId: string, searches: ScheduledJobSearch[]) => Promise<void>): void {
    if (!config.enabled) { this.logger.info({ event: 'scheduler.disabled' }); return; }
    if (this.scheduled) throw new Error('Scheduler has already started.');
    this.scheduled = this.driver.schedule(config.cron, async () => { this.logger.info({ event: 'scheduler.tick' }); try { await tick(config.candidateId, config.searches); } catch { this.logger.error({ event: 'scheduler.search.failed', errorCode: 'SCHEDULER_TICK_FAILED' }); } }, config.timezone);
    this.logger.info({ event: 'scheduler.started', cron: config.cron, timezone: config.timezone, searchCount: config.searches.length });
  }
  public stop(): void { this.scheduled?.stop(); this.scheduled = undefined; }
}
