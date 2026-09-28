import { describe, expect, it } from 'vitest';
import {
  parseKalibrrSearchPage,
  parseKalibrrDetailPage,
} from '../../../../src/scraping/providers/kalibrr/kalibrr.parser.js';

describe('Kalibrr Parser', () => {
  const sampleSearchHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="job-list">
          <!-- Job card 1 with Schema.org microdata -->
          <div class="k-grid k-border k-rounded-lg job-card" itemscope itemtype="http://schema.org/JobPosting">
            <a itemprop="title" href="/c/tech-nusantara/jobs/98765/senior-fullstack-engineer" class="k-text-primary-color">
              <h2>Senior Fullstack Engineer</h2>
            </a>
            <div class="k-text-subdued">
              <a itemprop="hiringOrganization" href="/c/tech-nusantara">PT Tech Nusantara</a>
            </div>
            <div class="k-flex k-items-center">
              <span itemprop="addressLocality">Jakarta, Indonesia</span>
              <span class="work-mode-badge">Hybrid</span>
              <span class="salary-info">IDR 15,000,000 - 25,000,000</span>
            </div>
            <span class="k-text-caption">Posted 4 days ago</span>
          </div>

          <!-- Job card 2 with alternative class names -->
          <div class="k-grid job-item">
            <a href="https://www.kalibrr.com/c/finance-corp/jobs/54321/data-analyst">
              <h3>Junior Data Analyst</h3>
            </a>
            <span class="company-name">Finance Corp Indonesia</span>
            <span class="location-name">Bandung, Indonesia</span>
            <span class="work-arrangement">Work from home</span>
            <span class="posted-date">Posted 1 day ago</span>
          </div>
        </div>
      </body>
    </html>
  `;

  const sampleDetailHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="job-detail">
          <div itemprop="description" class="k-text-body">
            <p>We are seeking an experienced Fullstack Engineer to drive our core products.</p>
          </div>
          <div itemprop="responsibilities">
            <h4>Responsibilities:</h4>
            <ul>
              <li>Design scalable backend architectures</li>
              <li>Collaborate with cross-functional product teams</li>
            </ul>
          </div>
          <div itemprop="qualifications">
            <h4>Qualifications:</h4>
            <ul>
              <li>At least 4 years of experience with Node.js and React</li>
              <li>Strong problem-solving abilities</li>
            </ul>
          </div>
          <div class="skills-container">
            <span class="k-tag">Node.js</span>
            <span class="k-tag">React</span>
            <span class="k-tag">PostgreSQL</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it('extracts job cards from search page HTML with relative date parsing', () => {
    const jobs = parseKalibrrSearchPage(sampleSearchHtml, 'https://www.kalibrr.com');
    expect(jobs.length).toBe(2);

    const first = jobs[0];
    expect(first.title).toBe('Senior Fullstack Engineer');
    expect(first.company).toBe('PT Tech Nusantara');
    expect(first.location).toBe('Jakarta, Indonesia');
    expect(first.source).toBe('kalibrr');
    expect(first.workMode).toBe('hybrid');
    expect(first.salaryMin).toBe(15000000);
    expect(first.salaryMax).toBe(25000000);
    expect(first.salaryCurrency).toBe('IDR');
    expect(first.jobUrl).toBe('https://www.kalibrr.com/c/tech-nusantara/jobs/98765/senior-fullstack-engineer');
    expect(first.externalId).toBe('98765');
    expect(first.publishedAt).toBeDefined();

    const second = jobs[1];
    expect(second.title).toBe('Junior Data Analyst');
    expect(second.company).toBe('Finance Corp Indonesia');
    expect(second.workMode).toBe('remote');
    expect(second.location).toBe('Bandung, Indonesia');
    expect(second.jobUrl).toBe('https://www.kalibrr.com/c/finance-corp/jobs/54321/data-analyst');
    expect(second.externalId).toBe('54321');
  });

  it('extracts detail description, qualifications, and skills from detail page HTML', () => {
    const detail = parseKalibrrDetailPage(sampleDetailHtml);
    expect(detail).toBeDefined();
    expect(detail.description).toContain('We are seeking an experienced Fullstack Engineer');
    expect(detail.description).toContain('Design scalable backend architectures');
    expect(detail.skills).toContain('Node.js');
    expect(detail.skills).toContain('React');
    expect(detail.skills).toContain('PostgreSQL');
  });

  it('extracts jobs from embedded JSON state if present', () => {
    const jsonStateHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "jobs": [
                    {
                      "id": 112233,
                      "name": "DevOps Engineer",
                      "company_name": "Cloud Tech Inc",
                      "city": "Jakarta",
                      "country": "Indonesia",
                      "work_arrangement": "Remote",
                      "salary_min": 18000000,
                      "salary_max": 28000000,
                      "currency": "IDR",
                      "created_at": "2026-09-24T10:00:00.000Z",
                      "job_slug": "devops-engineer",
                      "company_slug": "cloud-tech-inc"
                    }
                  ]
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    const jobs = parseKalibrrSearchPage(jsonStateHtml, 'https://www.kalibrr.com');
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('DevOps Engineer');
    expect(jobs[0].company).toBe('Cloud Tech Inc');
    expect(jobs[0].workMode).toBe('remote');
    expect(jobs[0].salaryMin).toBe(18000000);
    expect(jobs[0].jobUrl).toBe('https://www.kalibrr.com/c/cloud-tech-inc/jobs/112233/devops-engineer');
  });

  it('handles empty or malformed HTML gracefully', () => {
    expect(parseKalibrrSearchPage('', 'https://www.kalibrr.com')).toEqual([]);
    expect(parseKalibrrDetailPage('')).toEqual({ description: '' });
  });
});
