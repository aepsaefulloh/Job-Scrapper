import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserService, BrowserSession } from '../../../src/browser/browser.interface.js';
import { LokerIdScraper } from '../../../src/scraping/providers/loker-id/loker-id.scraper.js';

describe('LokerIdScraper', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/scrapers/loker-id');
  const searchHtml = fs.readFileSync(path.join(fixturesDir, 'search-page.html'), 'utf-8');
  const detailHtml = fs.readFileSync(path.join(fixturesDir, 'job-detail.html'), 'utf-8');

  it('navigates with correct search query parameters and extracts jobs with details', async () => {
    const visitedUrls: string[] = [];
    const mockSession: BrowserSession = {
      goto: vi.fn().mockImplementation(async (url: string) => {
        visitedUrls.push(url);
      }),
      getContent: vi.fn().mockImplementation(async () => {
        const lastUrl = visitedUrls[visitedUrls.length - 1];
        if (lastUrl.includes('cari-lowongan-kerja')) {
          return searchHtml;
        }
        return detailHtml;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser: BrowserService = {
      createSession: vi.fn().mockResolvedValue(mockSession),
    };

    const scraper = new LokerIdScraper(mockBrowser, 'https://www.loker.id');
    const jobs = await scraper.search({
      keyword: 'accountant',
      location: 'jakarta',
      maxPages: 1,
    });

    expect(mockBrowser.createSession).toHaveBeenCalledOnce();
    expect(mockSession.close).toHaveBeenCalledOnce();
    expect(visitedUrls[0]).toContain('/cari-lowongan-kerja?q=accountant&lokasi=jakarta');

    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].source).toBe('loker-id');
    expect(jobs[0].description).toBeTruthy();
  });

  it('respects bounded pagination (maxPages)', async () => {
    const visitedUrls: string[] = [];
    const mockSession: BrowserSession = {
      goto: vi.fn().mockImplementation(async (url: string) => {
        visitedUrls.push(url);
      }),
      getContent: vi.fn().mockResolvedValue(searchHtml),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser: BrowserService = {
      createSession: vi.fn().mockResolvedValue(mockSession),
    };

    const scraper = new LokerIdScraper(mockBrowser, 'https://www.loker.id');
    await scraper.search({
      keyword: 'tax',
      page: 1,
      maxPages: 2,
    });

    const searchUrls = visitedUrls.filter((u) => u.includes('cari-lowongan-kerja'));
    expect(searchUrls).toHaveLength(2);
    expect(searchUrls[0]).toContain('/cari-lowongan-kerja?q=tax');
    expect(searchUrls[1]).toContain('/cari-lowongan-kerja/page/2?q=tax');
  });

  it('continues scraping remaining jobs if a detail page navigation fails', async () => {
    let callCount = 0;
    const mockSession: BrowserSession = {
      goto: vi.fn().mockImplementation(async (url: string) => {
        if (!url.includes('cari-lowongan-kerja')) {
          callCount++;
          if (callCount === 1) {
            throw new Error('Navigation timeout on detail page');
          }
        }
      }),
      getContent: vi.fn().mockImplementation(async () => {
        return searchHtml;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser: BrowserService = {
      createSession: vi.fn().mockResolvedValue(mockSession),
    };

    const scraper = new LokerIdScraper(mockBrowser, 'https://www.loker.id');
    const jobs = await scraper.search({
      keyword: 'accountant',
      maxPages: 1,
    });

    // The scraper should not abort, and return jobs
    expect(jobs.length).toBeGreaterThan(0);
    expect(mockSession.close).toHaveBeenCalledOnce();
  });

  it('falls back to combined keyword search if location slug causes 404', async () => {
    const visitedUrls: string[] = [];
    const mockSession: BrowserSession = {
      goto: vi.fn().mockImplementation(async (url: string) => {
        visitedUrls.push(url);
      }),
      getContent: vi.fn().mockImplementation(async () => {
        const lastUrl = visitedUrls[visitedUrls.length - 1];
        if (lastUrl.includes('lokasi=')) {
          return '<title>Halaman Tidak Ditemukan (404) - LokerID</title><body>404 Not Found</body>';
        }
        return searchHtml;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser: BrowserService = {
      createSession: vi.fn().mockResolvedValue(mockSession),
    };

    const scraper = new LokerIdScraper(mockBrowser, 'https://www.loker.id');
    const jobs = await scraper.search({
      keyword: 'staff administrasi',
      location: 'Bandung',
      maxPages: 1,
    });

    const searchUrls = visitedUrls.filter((u) => u.includes('cari-lowongan-kerja'));
    expect(searchUrls).toHaveLength(2);
    expect(searchUrls[0]).toContain('lokasi=bandung');
    expect(searchUrls[1]).toContain('q=staff+administrasi+Bandung');
    expect(jobs.length).toBeGreaterThan(0);
  });
});
