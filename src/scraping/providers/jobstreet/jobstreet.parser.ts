import type { ScrapedJob } from '../../scraper.interface.js';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const field = (html: string, name: string) => new RegExp(`<[^>]*data-automation=["']${name}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i').exec(html)?.[1];

export function parseJobstreetSearchPage(html: string, baseUrl: string, scrapedAt = new Date().toISOString()): ScrapedJob[] {
  return [...html.matchAll(/<article[^>]*data-automation=["']job-card["'][^>]*>([\s\S]*?)<\/article>/gi)].flatMap((match) => {
    const card = match[1] ?? ''; const titleAnchor = /<a[^>]*data-automation=["']jobTitle["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(card);
    if (!titleAnchor) return [];
    const href = new URL(titleAnchor[1] ?? '', baseUrl).toString();
    const externalId = /\/job\/([^/?#]+)/i.exec(href)?.[1];
    const company = field(card, 'jobCompany'); const location = field(card, 'jobLocation'); const listingDate = field(card, 'jobListingDate');
    return [{ source: 'jobstreet', ...(externalId ? { externalId } : {}), title: text(titleAnchor[2] ?? ''), ...(company ? { company: text(company) } : {}), ...(location ? { location: text(location) } : {}), jobUrl: href, scrapedAt, metadata: { ...(listingDate ? { listingDate: text(listingDate) } : {}) } }];
  });
}
export function parseJobstreetDetailPage(html: string): string | undefined {
  const details = field(html, 'jobAdDetails');
  const description = details ? text(details) : '';
  return description || undefined;
}
