import cron from 'node-cron';
import type { SchedulerDriver } from './scheduler.service.js';
export class NodeCronDriver implements SchedulerDriver {
  public schedule(expression: string, task: () => Promise<void>, timezone: string): { stop(): void } {
    if (!cron.validate(expression)) throw new Error('JOB_SCRAPE_CRON is invalid.');
    let scheduled: ReturnType<typeof cron.schedule>;
    try { scheduled = cron.schedule(expression, () => { void task(); }, { timezone }); }
    catch { throw new Error('JOB_SCRAPE_TIMEZONE is invalid.'); }
    return { stop: () => scheduled.stop() };
  }
}
