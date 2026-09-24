import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseDeallsDetailPage,
  parseDeallsSearchPage,
} from '../../../src/scraping/providers/dealls/dealls.parser.js';

describe('Dealls Parser', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/scrapers/dealls');
  const searchHtml = fs.readFileSync(path.join(fixturesDir, 'search-page.html'), 'utf8');
  const detailHtml = fs.readFileSync(path.join(fixturesDir, 'job-detail.html'), 'utf8');

  describe('parseDeallsSearchPage', () => {
    it('extracts jobs accurately from real search page fixture', () => {
      const jobs = parseDeallsSearchPage(searchHtml);
      expect(jobs.length).toBe(18);

      const first = jobs[0];
      expect(first.source).toBe('dealls');
      expect(first.externalId).toBe('6ab4c86f50810600127a5c1b');
      expect(first.title).toBe('Admision Marketing Graduate Program (Penempatan Surabaya)');
      expect(first.company).toBe('Universitas Ciputra');
      expect(first.workMode).toBe('onsite');
      expect(first.employmentType).toBe('full-time');
      expect(first.location).toBe('Surabaya, Indonesia');
      expect(first.jobUrl).toBe(
        'https://dealls.com/loker/admision-marketing-graduate-program~universitas-ciputra-surabaya'
      );
      expect(first.publishedAt).toBe('2026-09-24T06:51:27.591Z');
      expect(first.skills).toBeDefined();
      expect(first.skills).toContain('Administrasi & Data Entry');
    });

    it('maps work modes correctly', () => {
      const syntheticHtml = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "dehydratedState": {
                "queries": [
                  {
                    "queryKey": ["/v1/explore-job/job"],
                    "state": {
                      "data": {
                        "pages": [
                          {
                            "docs": [
                              {
                                "id": "job-1",
                                "slug": "remote-dev",
                                "role": "Remote Developer",
                                "workplaceType": "remote",
                                "employmentTypes": ["fullTime"],
                                "company": { "name": "RemoteCo", "slug": "remoteco" }
                              },
                              {
                                "id": "job-2",
                                "slug": "hybrid-pm",
                                "role": "Hybrid PM",
                                "workplaceType": "hybrid",
                                "employmentTypes": ["internship"],
                                "company": { "name": "HybridCo", "slug": "hybridco" }
                              },
                              {
                                "id": "job-3",
                                "slug": "onsite-eng",
                                "role": "Onsite Engineer",
                                "workplaceType": "onSite",
                                "employmentTypes": ["contract"],
                                "company": { "name": "OnsiteCo", "slug": "onsiteco" }
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

      const jobs = parseDeallsSearchPage(syntheticHtml);
      expect(jobs).toHaveLength(3);
      expect(jobs[0].workMode).toBe('remote');
      expect(jobs[0].employmentType).toBe('full-time');
      expect(jobs[1].workMode).toBe('hybrid');
      expect(jobs[1].employmentType).toBe('internship');
      expect(jobs[2].workMode).toBe('onsite');
      expect(jobs[2].employmentType).toBe('contract');
    });

    it('extracts salary range when present', () => {
      const syntheticHtml = `
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
                                "id": "salary-job",
                                "slug": "lead-eng",
                                "role": "Lead Engineer",
                                "salaryRange": {
                                  "min": 15000000,
                                  "max": 25000000,
                                  "currency": "IDR"
                                },
                                "company": { "name": "FintechCo", "slug": "fintechco" }
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

      const jobs = parseDeallsSearchPage(syntheticHtml);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].salaryMin).toBe(15000000);
      expect(jobs[0].salaryMax).toBe(25000000);
      expect(jobs[0].salaryCurrency).toBe('IDR');
    });

    it('falls back to regex DOM parsing when __NEXT_DATA__ is absent', () => {
      const domHtml = `
        <html>
          <body>
            <div class="jobs">
              <a href="/loker/frontend-developer-jakarta~tech-corp">Frontend Developer</a>
              <a href="/loker/backend-developer-bandung~data-labs">Backend Developer</a>
            </div>
          </body>
        </html>
      `;

      const jobs = parseDeallsSearchPage(domHtml);
      expect(jobs).toHaveLength(2);
      expect(jobs[0].title).toBe('Frontend Developer');
      expect(jobs[0].jobUrl).toBe('https://dealls.com/loker/frontend-developer-jakarta~tech-corp');
      expect(jobs[0].source).toBe('dealls');
      expect(jobs[1].title).toBe('Backend Developer');
      expect(jobs[1].jobUrl).toBe('https://dealls.com/loker/backend-developer-bandung~data-labs');
    });

    it('handles malformed JSON without crashing', () => {
      const brokenHtml = '<script id="__NEXT_DATA__">NOT_VALID_JSON</script>';
      const jobs = parseDeallsSearchPage(brokenHtml);
      expect(jobs).toEqual([]);
    });
  });

  describe('parseDeallsDetailPage', () => {
    it('extracts and cleans responsibilities and requirements from detail page fixture', () => {
      const description = parseDeallsDetailPage(detailHtml);
      expect(description).toBeDefined();
      expect(description).toContain('Responsibilities:');
      expect(description).toContain('Coordinate with e-commerce platforms');
      expect(description).toContain('Requirements:');
      expect(description).toContain('1–2 years of experience');
      expect(description).not.toContain('<ul>');
      expect(description).not.toContain('<li>');
    });

    it('returns description directly when description field exists', () => {
      const jsonHtml = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "dehydratedState": {
                "queries": [
                  {
                    "state": {
                      "data": {
                        "id": "123",
                        "role": "QA Engineer",
                        "description": "<p>We are seeking a QA Engineer with Cypress knowledge.</p>"
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

      const description = parseDeallsDetailPage(jsonHtml);
      expect(description).toBeDefined();
      expect(description).toBe('We are seeking a QA Engineer with Cypress knowledge.');
    });

    it('falls back to DOM parsing when __NEXT_DATA__ is not present', () => {
      const domHtml = `
        <div class="job-description">
          <p>Must have 5+ years of experience with Node.js and TypeScript.</p>
        </div>
      `;

      const description = parseDeallsDetailPage(domHtml);
      expect(description).toBeDefined();
      expect(description).toContain('Must have 5+ years of experience with Node.js and TypeScript.');
    });

    it('returns undefined when no content is found', () => {
      const emptyHtml = '<html><body><div>Empty</div></body></html>';
      expect(parseDeallsDetailPage(emptyHtml)).toBeUndefined();
    });
  });
});
