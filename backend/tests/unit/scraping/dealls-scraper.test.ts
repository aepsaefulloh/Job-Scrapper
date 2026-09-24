import { describe, expect, it, vi } from 'vitest';
import type { BrowserService } from '../../../src/browser/browser.interface.js';
import { DeallsScraper } from '../../../src/scraping/providers/dealls/dealls.scraper.js';

describe('DeallsScraper', () => {
  const searchPageJson = (id: string, slug: string, role: string) => `
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "dehydratedState": {
            "queries": [
              {
                "state": {
                  "data": {
                    "pages": [
                      {
                        "docs": [
                          {
                            "id": "${id}",
                            "slug": "${slug}",
                            "role": "${role}",
                            "company": { "name": "Company ${id}", "slug": "company-${id}" }
                          }
                        ]
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    }
    </script>
  `;

  const detailPageJson = (resp: string, req: string) => `
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "dehydratedState": {
            "queries": [
              {
                "state": {
                  "data": {
                    "responsibilities": "<p>${resp}</p>",
                    "requirements": "<p>${req}</p>"
                  }
                }
              }
            ]
          }
        }
      }
    }
    </script>
  `;

  it('searches with bounded maxPages and extracts details in one session', async () => {
    const pages = [
      searchPageJson('d-1', 'frontend-dev', 'Frontend Developer'),
      detailPageJson('Build UI components', 'Proficient in Vue/React'),
      searchPageJson('d-2', 'backend-dev', 'Backend Developer'),
      detailPageJson('Design REST APIs', 'Experience with Node/Postgres'),
    ];

    const goto = vi.fn();
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new DeallsScraper(browser, 'https://dealls.test');
    const jobs = await scraper.search({ keyword: 'developer', maxPages: 2 });

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe('Frontend Developer');
    expect(jobs[0].description).toContain('Build UI components');
    expect(jobs[0].source).toBe('dealls');
    expect(jobs[1].title).toBe('Backend Developer');
    expect(jobs[1].description).toContain('Design REST APIs');

    expect(goto.mock.calls.map(([url]) => url)).toEqual([
      'https://dealls.test/loker?q=developer&page=1',
      'https://dealls.test/loker/frontend-dev~company-d-1',
      'https://dealls.test/loker?q=developer&page=2',
      'https://dealls.test/loker/backend-dev~company-d-2',
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
      searchPageJson('retry-id', 'software-eng', 'Software Engineer'),
      detailPageJson('Core backend development', 'TypeScript knowledge'),
    ];
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new DeallsScraper(browser, 'https://dealls.test');
    const jobs = await scraper.search({ keyword: 'software', maxPages: 1 });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Software Engineer');
    expect(jobs[0].description).toContain('Core backend development');
    expect(close).toHaveBeenCalled();
  });

  it('preserves job summary even if single detail page navigation fails', async () => {
    const pages = [searchPageJson('fallback-id', 'data-analyst', 'Data Analyst')];

    const goto = vi.fn(async (url: string) => {
      if (url.includes('/loker/data-analyst')) {
        throw new Error('500 Server Error');
      }
    });
    const getContent = vi.fn(async () => pages.shift() ?? '');
    const close = vi.fn();
    const browser: BrowserService = {
      createSession: vi.fn(async () => ({ goto, getContent, close })),
    };

    const scraper = new DeallsScraper(browser, 'https://dealls.test');
    const jobs = await scraper.search({ keyword: 'data', maxPages: 1 });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Data Analyst');
    expect(jobs[0].description).toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });
});
