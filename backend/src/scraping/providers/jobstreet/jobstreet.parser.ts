import type { ScrapedJob } from '../../scraper.interface.js';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const field = (html: string, name: string) => new RegExp(`<[^>]*data-automation=["']${name}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i').exec(html)?.[1];

function extractTagContent(html: string, dataAutomation: string): string | undefined {
  const openRegex = new RegExp(`<([a-zA-Z0-9]+)[^>]*data-automation=["']${dataAutomation}["'][^>]*>`, 'i');
  const match = openRegex.exec(html);
  if (!match || !match[1]) return undefined;
  const tagName = match[1].toLowerCase();
  const startIndex = match.index + match[0].length;
  let depth = 1;
  const tagRegex = new RegExp(`<\/?${tagName}[^>]*>`, 'gi');
  tagRegex.lastIndex = startIndex;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    if (tagMatch[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return html.slice(startIndex, tagMatch.index);
      }
    } else if (!tagMatch[0].endsWith('/>')) {
      depth++;
    }
  }
  return html.slice(startIndex);
}

export function parseJobstreetSearchPage(html: string, baseUrl: string, scrapedAt = new Date().toISOString()): ScrapedJob[] {
  const cardRegex = /<article[^>]*(?:data-automation=["'](?:job-card|normalJob)["']|data-card-type=["']JobCard["']|data-testid=["']job-card["'])[^>]*>([\s\S]*?)<\/article>/gi;
  return [...html.matchAll(cardRegex)].flatMap((match) => {
    const card = match[1] ?? '';
    const titleAnchor = /<a[^>]*data-automation=["']jobTitle["'][^>]*>([\s\S]*?)<\/a>/i.exec(card);
    if (!titleAnchor) return [];
    const rawHref = /href=["']([^"']+)["']/i.exec(titleAnchor[0])?.[1] ?? '';
    if (!rawHref) return [];
    const href = new URL(rawHref, baseUrl).toString();
    const externalId = /\/job\/([^/?#]+)/i.exec(href)?.[1];
    const company = field(card, 'jobCompany');
    const location = field(card, 'jobLocation');
    const listingDate = field(card, 'jobListingDate');
    return [{
      source: 'jobstreet',
      ...(externalId ? { externalId } : {}),
      title: text(titleAnchor[1] ?? ''),
      ...(company ? { company: text(company) } : {}),
      ...(location ? { location: text(location) } : {}),
      jobUrl: href,
      scrapedAt,
      metadata: { ...(listingDate ? { listingDate: text(listingDate) } : {}) }
    }];
  });
}

export function parseJobstreetDetailPage(html: string): string | undefined {
  const raw = extractTagContent(html, 'jobAdDetails');
  if (!raw) {
    const fallback = field(html, 'jobAdDetails');
    return fallback ? text(fallback) : undefined;
  }
  const description = text(raw);
  return description || undefined;
}

