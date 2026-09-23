import { describe, expect, it, vi } from 'vitest';
import { NodeCronDriver } from '../../../src/scheduler/node-cron.driver.js';

describe('NodeCronDriver', () => {
  it('rejects an invalid cron expression with a safe configuration error', () => {
    expect(() => new NodeCronDriver().schedule('not a cron', vi.fn(), 'Asia/Jakarta')).toThrow('JOB_SCRAPE_CRON is invalid.');
  });

  it('rejects an invalid timezone with a safe configuration error', () => {
    expect(() => new NodeCronDriver().schedule('0 7 * * *', vi.fn(), 'not/a-timezone')).toThrow('JOB_SCRAPE_TIMEZONE is invalid.');
  });
});
