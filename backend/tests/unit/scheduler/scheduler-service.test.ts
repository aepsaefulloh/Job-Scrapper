import { describe, expect, it, vi } from 'vitest';
import { SchedulerService } from '../../../src/scheduler/scheduler.service.js';

describe('SchedulerService', () => {
  it('does not register tasks when disabled', () => {
    const schedule = vi.fn(); const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    new SchedulerService({ schedule }, logger).start({ enabled: false, cron: '0 7 * * *', timezone: 'Asia/Jakarta', candidateId: '', searches: [] }, vi.fn());
    expect(schedule).not.toHaveBeenCalled(); expect(logger.info).toHaveBeenCalledWith({ event: 'scheduler.disabled' });
  });
  it('registers one configurable task and stops it cleanly', async () => {
    const stop = vi.fn(); let callback: (() => Promise<void>) | undefined; const schedule = vi.fn((_cron, task) => { callback = task; return { stop }; }); const tick = vi.fn().mockResolvedValue(undefined);
    const service = new SchedulerService({ schedule }, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    service.start({ enabled: true, cron: '0 7 * * *', timezone: 'Asia/Jakarta', candidateId: 'candidate', searches: [{ source: 'jobstreet', keyword: 'backend' }] }, tick);
    expect(schedule).toHaveBeenCalledWith('0 7 * * *', expect.any(Function), 'Asia/Jakarta'); await callback?.(); expect(tick).toHaveBeenCalled(); service.stop(); expect(stop).toHaveBeenCalled();
  });
});
