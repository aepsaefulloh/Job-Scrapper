import { describe, expect, it, vi } from 'vitest';
import type { BrowserService } from '../../../src/browser/browser.interface.js';
import { JobstreetScraper } from '../../../src/scraping/providers/jobstreet/jobstreet.scraper.js';

describe('JobstreetScraper', () => {
  it('honors a bounded maxPages query in one browser session', async () => {
    const pages = [
      '<article data-automation="job-card"><a data-automation="jobTitle" href="/job/1">Backend One</a><a data-automation="jobCompany">Acme</a></article>',
      '<div data-automation="jobAdDetails">First description</div>',
      '<article data-automation="job-card"><a data-automation="jobTitle" href="/job/2">Backend Two</a><a data-automation="jobCompany">Acme</a></article>',
      '<div data-automation="jobAdDetails">Second description</div>'
    ];
    const goto = vi.fn();
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = { createSession: vi.fn(async () => ({ goto, getContent, close })) };

    const jobs = await new JobstreetScraper(browser, 'https://example.test').search({ keyword: 'backend', maxPages: 2 });

    expect(jobs).toHaveLength(2);
    expect(goto.mock.calls.map(([url]) => url)).toEqual([
      'https://example.test/id/jobs?keyword=backend&page=1',
      'https://example.test/job/1',
      'https://example.test/id/jobs?keyword=backend&page=2',
      'https://example.test/job/2'
    ]);
    expect(close).toHaveBeenCalledOnce();
  });
});
