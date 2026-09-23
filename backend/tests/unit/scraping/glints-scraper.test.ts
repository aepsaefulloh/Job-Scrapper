import { describe, expect, it, vi } from 'vitest';
import type { BrowserService } from '../../../src/browser/browser.interface.js';
import { GlintsScraper } from '../../../src/scraping/providers/glints/glints.scraper.js';

describe('GlintsScraper', () => {
  const searchPageJson = (id: string, title: string) => `
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "initialJobs": {
            "jobsInPage": [
              {
                "id": "${id}",
                "title": "${title}",
                "company": { "name": "Company ${id}" }
              }
            ]
          }
        }
      }
    }
    </script>
  `;

  const detailPageJson = (desc: string) => `
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "initialData": {
            "data": {
              "descriptionJsonString": ${JSON.stringify(JSON.stringify({ blocks: [{ text: desc }] }))}
            }
          }
        }
      }
    }
    </script>
  `;

  it('searches with bounded maxPages and extracts details in one session', async () => {
    const pages = [
      searchPageJson('glints-1', 'Frontend Engineer'),
      detailPageJson('Frontend description'),
      searchPageJson('glints-2', 'Backend Engineer'),
      detailPageJson('Backend description'),
    ];

    const goto = vi.fn();
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new GlintsScraper(browser, 'https://glints.test');
    const jobs = await scraper.search({ keyword: 'engineer', maxPages: 2 });

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe('Frontend Engineer');
    expect(jobs[0].description).toBe('Frontend description');
    expect(jobs[0].source).toBe('glints');
    expect(jobs[1].title).toBe('Backend Engineer');
    expect(jobs[1].description).toBe('Backend description');

    expect(goto.mock.calls.map(([url]) => url)).toEqual([
      'https://glints.test/id/opportunities/jobs/explore?keyword=engineer&page=1',
      'https://glints.test/id/opportunities/jobs/glints-1',
      'https://glints.test/id/opportunities/jobs/explore?keyword=engineer&page=2',
      'https://glints.test/id/opportunities/jobs/glints-2',
    ]);
    expect(close).toHaveBeenCalledOnce();
  });

  it('retries on transient failure and closes session cleanly', async () => {
    let attempts = 0;
    const goto = vi.fn(async (url: string) => {
      attempts++;
      if (attempts === 1) {
        throw Object.assign(new Error('Connection reset'), { code: 'NETWORK_ERROR' });
      }
    });

    const pages = [
      searchPageJson('glints-retry', 'Software Engineer'),
      detailPageJson('Description after retry'),
    ];
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new GlintsScraper(browser, 'https://glints.test');
    const jobs = await scraper.search({ keyword: 'software', maxPages: 1 });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Software Engineer');
    expect(jobs[0].description).toBe('Description after retry');
    expect(close).toHaveBeenCalled();
  });

  it('preserves job summary even if single detail page fetch fails', async () => {
    const pages = [
      searchPageJson('glints-fallback', 'Data Analyst'),
    ];

    const goto = vi.fn(async (url: string) => {
      if (url.includes('/id/opportunities/jobs/glints-fallback')) {
        throw new Error('404 Not Found');
      }
    });
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new GlintsScraper(browser, 'https://glints.test');
    const jobs = await scraper.search({ keyword: 'data', maxPages: 1 });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Data Analyst');
    expect(jobs[0].description).toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });
});
