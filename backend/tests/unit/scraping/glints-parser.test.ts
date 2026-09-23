import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGlintsDetailPage, parseGlintsSearchPage } from '../../../src/scraping/providers/glints/glints.parser.js';

describe('Glints Parser', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/scrapers/glints');
  const searchHtml = fs.readFileSync(path.join(fixturesDir, 'search-page.html'), 'utf8');
  const detailHtml = fs.readFileSync(path.join(fixturesDir, 'job-detail.html'), 'utf8');

  describe('parseGlintsSearchPage', () => {
    it('extracts all 30 jobs from the search page fixture', () => {
      const jobs = parseGlintsSearchPage(searchHtml);
      expect(jobs).toHaveLength(30);

      const first = jobs[0];
      expect(first.source).toBe('glints');
      expect(first.externalId).toBe('6261fd20-55be-4a28-9586-ddb7547fdb04');
      expect(first.title).toBe('Accountant');
      expect(first.company).toBe('Tonggi Coffee');
      expect(first.workMode).toBe('onsite');
      expect(first.employmentType).toBe('full-time');
      expect(first.jobUrl).toBe('https://glints.com/id/opportunities/jobs/6261fd20-55be-4a28-9586-ddb7547fdb04');
      expect(first.publishedAt).toBe('2026-09-22T07:12:10.756112Z');
    });

    it('extracts salary information when available', () => {
      const jobs = parseGlintsSearchPage(searchHtml);
      const withSalary = jobs.find((j) => j.salaryMin !== undefined);

      expect(withSalary).toBeDefined();
      expect(withSalary?.salaryMin).toBe(4000000);
      expect(withSalary?.salaryMax).toBe(7000000);
      expect(withSalary?.salaryCurrency).toBe('IDR');
    });

    it('extracts skills when available', () => {
      const jobs = parseGlintsSearchPage(searchHtml);
      const withSkills = jobs.find((j) => j.skills && j.skills.length > 0);

      expect(withSkills).toBeDefined();
      expect(withSkills?.skills).toContain('Accounting');
      expect(withSkills?.skills).toContain('Microsoft Excel');
      expect(withSkills?.skills).toContain('SAP');
    });

    it('maps work arrangement options accurately', () => {
      const jobs = parseGlintsSearchPage(searchHtml);
      const onsiteJob = jobs.find((j) => j.workMode === 'onsite');
      expect(onsiteJob).toBeDefined();

      // Test synthetic remote and hybrid payloads
      const syntheticHtml = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "initialJobs": {
                "jobsInPage": [
                  {
                    "id": "remote-job-1",
                    "title": "Remote Engineer",
                    "workArrangementOption": "REMOTE",
                    "type": "CONTRACT"
                  },
                  {
                    "id": "hybrid-job-2",
                    "title": "Hybrid Designer",
                    "workArrangementOption": "HYBRID",
                    "type": "INTERNSHIP"
                  }
                ]
              }
            }
          }
        }
        </script>
      `;

      const parsed = parseGlintsSearchPage(syntheticHtml);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].workMode).toBe('remote');
      expect(parsed[0].employmentType).toBe('contract');
      expect(parsed[1].workMode).toBe('hybrid');
      expect(parsed[1].employmentType).toBe('internship');
    });

    it('falls back to DOM parsing if __NEXT_DATA__ is absent', () => {
      const domHtml = `
        <html>
          <body>
            <div class="job-list">
              <a href="/id/opportunities/jobs/job-abc-123">Senior Fullstack Developer</a>
              <a href="/id/opportunities/jobs/job-def-456">Product Designer</a>
            </div>
          </body>
        </html>
      `;

      const jobs = parseGlintsSearchPage(domHtml);
      expect(jobs).toHaveLength(2);
      expect(jobs[0].externalId).toBe('job-abc-123');
      expect(jobs[0].title).toBe('Senior Fullstack Developer');
      expect(jobs[0].jobUrl).toBe('https://glints.com/id/opportunities/jobs/job-abc-123');
      expect(jobs[1].externalId).toBe('job-def-456');
    });

    it('handles malformed JSON without crashing', () => {
      const brokenHtml = '<script id="__NEXT_DATA__">NOT_JSON</script>';
      const jobs = parseGlintsSearchPage(brokenHtml);
      expect(jobs).toEqual([]);
    });
  });

  describe('parseGlintsDetailPage', () => {
    it('extracts Draft.js plaintext description from job detail fixture', () => {
      const description = parseGlintsDetailPage(detailHtml);
      expect(description).toBeDefined();
      expect(description).toContain('TANGGUNG JAWAB');
      expect(description).toContain('Accounting & Financial Reporting');
      expect(description).toContain('Melakukan pencatatan dan penjurnalan');
      expect(description).not.toContain('<');
      expect(description).not.toContain('{"blocks":');
    });

    it('returns undefined if description is missing or empty', () => {
      const emptyHtml = '<script id="__NEXT_DATA__">{"props":{"pageProps":{"initialData":{"data":{}}}}}</script>';
      expect(parseGlintsDetailPage(emptyHtml)).toBeUndefined();
    });

    it('falls back to DOM extraction if __NEXT_DATA__ is not present', () => {
      const domHtml = `
        <div class="JobDescription__container">
          <p>This is a great opportunity to build systems.</p>
          <p>Must have 3 years of experience.</p>
        </div>
      `;
      const description = parseGlintsDetailPage(domHtml);
      expect(description).toBeDefined();
      expect(description).toContain('This is a great opportunity to build systems.');
    });
  });
});
