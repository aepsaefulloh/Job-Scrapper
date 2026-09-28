import { describe, expect, it } from 'bun:test';
import {
  detectLinkedInAuthWall,
  parseLinkedInDetailPage,
  parseLinkedInSearchPage,
} from '../../../../src/scraping/providers/linkedin/linkedin.parser.js';

describe('LinkedIn Parser', () => {
  const sampleAuthWallHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>LinkedIn: Log In or Sign Up</title></head>
      <body>
        <div class="authwall-join-form">
          <h2>Join LinkedIn or sign in to continue</h2>
          <form class="sign-in-form" action="/checkpoint/lg/login-submit">
            <input type="text" name="session_key" />
          </form>
        </div>
      </body>
    </html>
  `;

  const sampleSearchHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <ul class="jobs-search__results-list">
          <li>
            <div class="base-card base-card--link base-search-card base-search-card--link job-search-card" data-entity-urn="urn:li:jobPosting:3948572019">
              <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2]" href="https://id.linkedin.com/jobs/view/senior-backend-engineer-at-tech-asia-3948572019?position=1&pageNum=0">
                <span class="sr-only">Senior Backend Engineer</span>
              </a>
              <div class="base-search-card__info">
                <h3 class="base-search-card__title">
                  Senior Backend Engineer
                </h3>
                <h4 class="base-search-card__subtitle">
                  <a class="hidden-nested-link" href="https://id.linkedin.com/company/tech-asia">Tech Asia</a>
                </h4>
                <div class="base-search-card__metadata">
                  <span class="job-search-card__location">Jakarta, Indonesia (Remote)</span>
                  <time class="job-search-card__listdate" datetime="2026-09-27">
                    1 day ago
                  </time>
                </div>
              </div>
            </div>
          </li>
          <li>
            <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:3948572020">
              <a class="base-card__full-link" href="/jobs/view/3948572020">
                <span class="sr-only">Full Stack Developer</span>
              </a>
              <div class="base-search-card__info">
                <h3 class="base-search-card__title">
                  Full Stack Developer
                </h3>
                <h4 class="base-search-card__subtitle">
                  Global Software Inc
                </h4>
                <div class="base-search-card__metadata">
                  <span class="job-search-card__location">Bandung, West Java, Indonesia</span>
                  <time class="job-search-card__listdate--new" datetime="2026-09-28">
                    Just now
                  </time>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </body>
    </html>
  `;

  const sampleDetailHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="core-section-container__content break-words">
          <div class="show-more-less-html__markup show-more-less-html__markup--clamp-after-5">
            <p>We are seeking a <strong>Senior Backend Engineer</strong> to join our high-growth platform.</p>
            <h3>Responsibilities</h3>
            <ul>
              <li>Design scalable microservices using TypeScript and Go</li>
              <li>Collaborate with infrastructure and security teams</li>
              <li>Optimize PostgreSQL queries and cache layers</li>
            </ul>
            <h3>Qualifications</h3>
            <p>5+ years of experience in distributed systems.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  it('detects LinkedIn authwall and sign-in challenge pages correctly', () => {
    expect(detectLinkedInAuthWall(sampleAuthWallHtml)).toBe(true);
    expect(detectLinkedInAuthWall('<html><body><div class="authwall">Please login</div></body></html>')).toBe(true);
    expect(detectLinkedInAuthWall(sampleSearchHtml)).toBe(false);
  });

  it('extracts job cards from search page and canonicalizes to /jobs/view/{id}', () => {
    const jobs = parseLinkedInSearchPage(sampleSearchHtml);
    expect(jobs.length).toBe(2);

    expect(jobs[0].title).toBe('Senior Backend Engineer');
    expect(jobs[0].company).toBe('Tech Asia');
    expect(jobs[0].location).toBe('Jakarta, Indonesia (Remote)');
    expect(jobs[0].workMode).toBe('remote');
    expect(jobs[0].externalId).toBe('3948572019');
    expect(jobs[0].jobUrl).toBe('https://www.linkedin.com/jobs/view/3948572019');
    expect(jobs[0].source).toBe('linkedin');
    expect(jobs[0].publishedAt).toBe('2026-09-27T00:00:00.000Z');

    expect(jobs[1].title).toBe('Full Stack Developer');
    expect(jobs[1].company).toBe('Global Software Inc');
    expect(jobs[1].externalId).toBe('3948572020');
    expect(jobs[1].jobUrl).toBe('https://www.linkedin.com/jobs/view/3948572020');
  });

  it('extracts clean description from job description container', () => {
    const detail = parseLinkedInDetailPage(sampleDetailHtml);
    expect(detail.description).toContain('Senior Backend Engineer');
    expect(detail.description).toContain('Responsibilities');
    expect(detail.description).toContain('• Design scalable microservices using TypeScript and Go');
    expect(detail.description).toContain('5+ years of experience');
    expect(detail.description).not.toContain('<p>');
    expect(detail.description).not.toContain('<strong>');
  });

  it('handles empty, malformed, or authwalled HTML safely without throwing', () => {
    expect(parseLinkedInSearchPage('')).toEqual([]);
    expect(parseLinkedInSearchPage(sampleAuthWallHtml)).toEqual([]);
    expect(parseLinkedInDetailPage('')).toEqual({ description: '' });
    expect(parseLinkedInDetailPage(sampleAuthWallHtml)).toEqual({ description: '' });
  });
});
