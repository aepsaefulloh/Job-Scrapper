import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanHtmlToText,
  decodeHtmlEntities,
  normalizeLokerIdEmploymentType,
  normalizeLokerIdWorkMode,
  parseLokerIdDetailPage,
  parseLokerIdSearchPage,
} from '../../../src/scraping/providers/loker-id/loker-id.parser.js';

describe('LokerIdParser', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/scrapers/loker-id');
  const searchHtml = fs.readFileSync(path.join(fixturesDir, 'search-page.html'), 'utf-8');
  const detailHtml = fs.readFileSync(path.join(fixturesDir, 'job-detail.html'), 'utf-8');

  describe('normalizeLokerIdEmploymentType', () => {
    it('normalizes Indonesian and English employment types correctly', () => {
      expect(normalizeLokerIdEmploymentType('Penuh Waktu')).toBe('full-time');
      expect(normalizeLokerIdEmploymentType('Full Time')).toBe('full-time');
      expect(normalizeLokerIdEmploymentType('FULL_TIME')).toBe('full-time');
      expect(normalizeLokerIdEmploymentType('purna-waktu')).toBe('full-time');
      expect(normalizeLokerIdEmploymentType('Paruh Waktu')).toBe('part-time');
      expect(normalizeLokerIdEmploymentType('PART_TIME')).toBe('part-time');
      expect(normalizeLokerIdEmploymentType('Kontrak')).toBe('contract');
      expect(normalizeLokerIdEmploymentType('CONTRACT')).toBe('contract');
      expect(normalizeLokerIdEmploymentType('Magang')).toBe('internship');
      expect(normalizeLokerIdEmploymentType('Internship')).toBe('internship');
      expect(normalizeLokerIdEmploymentType('Freelance')).toBe('freelance');
    });

    it('returns undefined for null or empty input', () => {
      expect(normalizeLokerIdEmploymentType(null)).toBeUndefined();
      expect(normalizeLokerIdEmploymentType(undefined)).toBeUndefined();
      expect(normalizeLokerIdEmploymentType('')).toBeUndefined();
    });
  });

  describe('normalizeLokerIdWorkMode', () => {
    it('maps remote, hybrid, and onsite modes accurately', () => {
      expect(normalizeLokerIdWorkMode(true)).toBe('remote');
      expect(normalizeLokerIdWorkMode(false, { name: 'Dikantor', slug: 'dikantor' })).toBe('onsite');
      expect(normalizeLokerIdWorkMode(false, { name: 'Hibrida', slug: 'hibrida' })).toBe('hybrid');
      expect(normalizeLokerIdWorkMode(false, { name: 'Jarak Jauh', slug: 'remote' })).toBe('remote');
      expect(normalizeLokerIdWorkMode(false, null)).toBe('unknown');
    });
  });

  describe('cleanHtmlToText and decodeHtmlEntities', () => {
    it('decodes HTML entities and transforms list items to bullet points', () => {
      const html = '<ul><li>First item &amp; details</li><li>Second &quot;item&quot;</li></ul>';
      const text = cleanHtmlToText(html);
      expect(text).toContain('• First item & details');
      expect(text).toContain('• Second "item"');
    });
  });

  describe('parseLokerIdSearchPage', () => {
    it('extracts jobs and pagination metadata from offline search fixture', () => {
      const { jobs, pagination } = parseLokerIdSearchPage(searchHtml);

      expect(pagination.current_page).toBe(1);
      expect(pagination.last_page).toBeGreaterThanOrEqual(1);
      expect(pagination.total).toBeGreaterThan(0);

      expect(jobs.length).toBeGreaterThan(0);
      const firstJob = jobs[0];
      expect(firstJob.source).toBe('loker-id');
      expect(firstJob.externalId).toBeDefined();
      expect(firstJob.title).toBeTruthy();
      expect(firstJob.company).toBeTruthy();
      expect(firstJob.location).toBeTruthy();
      expect(firstJob.jobUrl).toMatch(/^https:\/\/www\.loker\.id\//);
      expect(firstJob.workMode).toBeDefined();
      expect(firstJob.scrapedAt).toBeDefined();
    });

    it('handles search pages with missing Remix context via fallback gracefully', () => {
      const fallbackHtml = `
        <html><body>
          <a href="https://www.loker.id/lowongan-kerja/finance-manager-12345.html">
            <h3>Finance Manager</h3>
          </a>
        </body></html>
      `;
      const { jobs } = parseLokerIdSearchPage(fallbackHtml);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Finance Manager');
      expect(jobs[0].source).toBe('loker-id');
      expect(jobs[0].externalId).toBe('12345');
    });

    it('handles empty or malformed search HTML without throwing', () => {
      const { jobs, pagination } = parseLokerIdSearchPage('<html><body><div>No jobs</div></body></html>');
      expect(jobs).toEqual([]);
      expect(pagination.current_page).toBe(1);
    });
  });

  describe('parseLokerIdDetailPage', () => {
    it('extracts responsibilities, qualifications, and description from offline detail fixture', () => {
      const detail = parseLokerIdDetailPage(detailHtml);

      expect(detail).not.toBeNull();
      expect(detail?.description).toBeTruthy();
      expect(detail?.description).toContain('Tanggung Jawab:');
      expect(detail?.description).toContain('Kualifikasi:');
      expect(detail?.requirements).toBeTruthy();
      expect(detail?.employmentType).toBe('full-time');
    });

    it('handles detail pages with only Schema.org JobPosting fallback', () => {
      const schemaHtml = `
        <html><head>
          <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "JobPosting",
            "title": "Tax Specialist",
            "description": "<p>Handle corporate tax compliance.</p>",
            "employmentType": "FULL_TIME"
          }
          </script>
        </head><body></body></html>
      `;
      const detail = parseLokerIdDetailPage(schemaHtml);
      expect(detail).not.toBeNull();
      expect(detail?.description).toContain('Handle corporate tax compliance.');
      expect(detail?.employmentType).toBe('full-time');
    });

    it('returns null for empty HTML or pages without job data', () => {
      const detail = parseLokerIdDetailPage('<html><body><div>Page not found</div></body></html>');
      expect(detail).toBeNull();
    });
  });
});
