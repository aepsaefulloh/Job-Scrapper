import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { KarirScraper } from '../../../../src/scraping/providers/karir/karir.scraper.js';
import type { BrowserService, BrowserSession } from '../../../../src/browser/browser.interface.js';

describe('KarirScraper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('searches opportunities via gateway API successfully', async () => {
    const mockLocations = {
      code: 200,
      data: [
        { id: 10027, name: 'Prov. DKI-Jakarta' },
        { id: 10158, name: 'Jakarta Pusat' },
      ],
    };

    const mockSearchResponse = {
      code: 200,
      data: {
        total_opportunities: 1,
        opportunities: [
          {
            id: 1401567,
            job_position: 'Staf Administrasi',
            company_name: 'PT Contoh Perusahaan',
            description: 'Jakarta Pusat',
            salary_lower: 5000000,
            salary_upper: 6000000,
            posted_at: '2026-10-01T07:00:00Z',
          },
        ],
      },
    };

    const mockDetailResponse = {
      code: 200,
      data: {
        id: 1401567,
        responsibilities: '<p>Tugas: Rekap data</p>',
        requirements: '<p>Syarat: Minimal SMA</p>',
        required_skills: [{ name: 'Admin' }],
      },
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/master_locations')) {
        return Promise.resolve(new Response(JSON.stringify(mockLocations), { status: 200 }));
      }
      if (url.includes('/v2/search/opportunities')) {
        return Promise.resolve(new Response(JSON.stringify(mockSearchResponse), { status: 200 }));
      }
      if (url.includes('/v1/opportunity/detail')) {
        return Promise.resolve(new Response(JSON.stringify(mockDetailResponse), { status: 200 }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const scraper = new KarirScraper(undefined, 'https://karir.com', undefined, 'https://gateway2-beta.karir.com');
    const results = await scraper.search({ keyword: 'admin', location: 'Jakarta', detailLimit: 1 });

    expect(results.length).toBe(1);
    expect(results[0]?.title).toBe('Staf Administrasi');
    expect(results[0]?.company).toBe('PT Contoh Perusahaan');
    expect(results[0]?.description).toContain('Tugas: Rekap data');
    expect(results[0]?.description).toContain('Syarat: Minimal SMA');
    expect(results[0]?.skills).toEqual(['Admin']);
  });

  it('falls back to browser session when API fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mockSession: BrowserSession = {
      goto: vi.fn().mockResolvedValue(undefined),
      getContent: vi.fn().mockResolvedValue(`
        <article class="opportunity-card">
          <a href="/opportunities/9999-browser-job"><h3 class="title">Browser Job</h3></a>
          <div class="company-name">Browser Company</div>
        </article>
      `),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser: BrowserService = {
      createSession: vi.fn().mockResolvedValue(mockSession),
    };

    const scraper = new KarirScraper(mockBrowser, 'https://karir.com');
    const results = await scraper.search({ keyword: 'test' });

    expect(results.length).toBe(1);
    expect(results[0]?.title).toBe('Browser Job');
    expect(mockBrowser.createSession).toHaveBeenCalled();
  });
});
