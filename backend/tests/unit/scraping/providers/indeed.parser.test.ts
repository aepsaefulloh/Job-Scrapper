import { describe, expect, it } from 'vitest';
import {
  parseIndeedSearchPage,
  parseIndeedDetailPage,
  detectIndeedChallenge,
} from '../../../../src/scraping/providers/indeed/indeed.parser.js';

describe('Indeed Parser', () => {
  const sampleSearchHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div id="mosaic-provider-jobcards">
          <ul class="css-5lfssm">
            <!-- Job card 1 with data-jk attribute -->
            <li class="css-5lfssm eu4oa1w0">
              <div class="cardOutline tapItem fs-unmask" data-jk="jk1234567890abcdef">
                <div class="slider_container">
                  <h2 class="jobTitle">
                    <a href="/rc/clk?jk=jk1234567890abcdef&from=serp" class="jcs-JobTitle">
                      <span>Senior Backend Engineer</span>
                    </a>
                  </h2>
                  <div class="company_location">
                    <span data-testid="company-name" class="css-63koeb">Fintech Global Indonesia</span>
                    <div data-testid="text-location" class="css-1p0sjhy">Jakarta</div>
                  </div>
                  <div class="metadata salary-snippet-container">
                    <div class="attribute_snippet">Rp 20.000.000 - Rp 30.000.000 per bulan</div>
                  </div>
                  <span class="date">Diposting 2 hari yang lalu</span>
                </div>
              </div>
            </li>

            <!-- Job card 2 with table structure fallback -->
            <li class="css-5lfssm">
              <div class="job_seen_beacon" data-jk="jk9876543210fedcba">
                <h2 class="jobTitle">
                  <a href="/viewjob?jk=jk9876543210fedcba">
                    <span>Fullstack Developer (Remote)</span>
                  </a>
                </h2>
                <span class="companyName">Digital Solusi</span>
                <span class="companyLocation">Remote di Jakarta</span>
                <span class="date">Posted 5 days ago</span>
              </div>
            </li>
          </ul>
        </div>
      </body>
    </html>
  `;

  const sampleChallengeHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Just a moment...</title></head>
      <body>
        <div class="cf-browser-verification cf-im-under-attack">
          <h1>Checking your browser before accessing indeed.com</h1>
          <p>This process is automatic. Your browser will redirect to your requested content shortly.</p>
          <div id="challenge-running">Ray ID: 7abc123</div>
        </div>
      </body>
    </html>
  `;

  const sampleDetailHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div id="jobDescriptionText" class="jobsearch-JobComponent-description">
          <p>About the role:</p>
          <p>We are seeking a talented Senior Backend Engineer to join our core engineering group.</p>
          <h3>Key Responsibilities:</h3>
          <ul>
            <li>Build resilient microservices using TypeScript and Go</li>
            <li>Maintain high availability database systems</li>
          </ul>
          <h3>Requirements:</h3>
          <ul>
            <li>5+ years of software development experience</li>
            <li>Strong experience in PostgreSQL and Redis</li>
          </ul>
        </div>
      </body>
    </html>
  `;

  it('detects Cloudflare / CAPTCHA challenge pages correctly', () => {
    expect(detectIndeedChallenge(sampleChallengeHtml)).toBe(true);
    expect(detectIndeedChallenge(sampleSearchHtml)).toBe(false);
    expect(detectIndeedChallenge('')).toBe(false);
  });

  it('extracts job cards from search page and canonicalizes to viewjob?jk= URL', () => {
    const jobs = parseIndeedSearchPage(sampleSearchHtml, 'https://id.indeed.com');
    expect(jobs.length).toBe(2);

    const first = jobs[0];
    expect(first.title).toBe('Senior Backend Engineer');
    expect(first.company).toBe('Fintech Global Indonesia');
    expect(first.location).toBe('Jakarta');
    expect(first.source).toBe('indeed');
    expect(first.salaryMin).toBe(20000000);
    expect(first.salaryMax).toBe(30000000);
    expect(first.salaryCurrency).toBe('IDR');
    expect(first.jobUrl).toBe('https://id.indeed.com/viewjob?jk=jk1234567890abcdef');
    expect(first.externalId).toBe('jk1234567890abcdef');
    expect(first.publishedAt).toBeDefined();

    const second = jobs[1];
    expect(second.title).toBe('Fullstack Developer (Remote)');
    expect(second.company).toBe('Digital Solusi');
    expect(second.workMode).toBe('remote');
    expect(second.jobUrl).toBe('https://id.indeed.com/viewjob?jk=jk9876543210fedcba');
    expect(second.externalId).toBe('jk9876543210fedcba');
  });

  it('extracts clean description from job description container', () => {
    const detail = parseIndeedDetailPage(sampleDetailHtml);
    expect(detail).toBeDefined();
    expect(detail.description).toContain('We are seeking a talented Senior Backend Engineer');
    expect(detail.description).toContain('Build resilient microservices');
  });

  it('handles empty, malformed, or challenged HTML safely without throwing', () => {
    expect(parseIndeedSearchPage(sampleChallengeHtml, 'https://id.indeed.com')).toEqual([]);
    expect(parseIndeedSearchPage('', 'https://id.indeed.com')).toEqual([]);
    expect(parseIndeedDetailPage('')).toEqual({ description: '' });
  });
});
