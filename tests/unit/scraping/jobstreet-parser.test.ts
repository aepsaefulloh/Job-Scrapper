import { describe, expect, it } from 'vitest';
import { parseJobstreetDetailPage, parseJobstreetSearchPage } from '../../../src/scraping/providers/jobstreet/jobstreet.parser.js';

describe('Jobstreet parser', () => {
  it('extracts canonical scraped jobs without inventing optional data', () => {
    const jobs = parseJobstreetSearchPage(`
      <article data-automation="job-card"><a data-automation="jobTitle" href="/job/123">Backend Engineer</a><a data-automation="jobCompany">Acme</a><span data-automation="jobLocation">Jakarta</span><span data-automation="jobListingDate">2d ago</span></article>
    `, 'https://id.jobstreet.com');

    expect(jobs).toEqual([expect.objectContaining({ source: 'jobstreet', externalId: '123', title: 'Backend Engineer', company: 'Acme', location: 'Jakarta', jobUrl: 'https://id.jobstreet.com/job/123' })]);
    expect(jobs[0]?.salaryMin).toBeUndefined();
  });
  it('extracts the required description from a detail page', () => {
    expect(parseJobstreetDetailPage('<div data-automation="jobAdDetails">Build reliable TypeScript services.</div>')).toBe('Build reliable TypeScript services.');
  });
});
