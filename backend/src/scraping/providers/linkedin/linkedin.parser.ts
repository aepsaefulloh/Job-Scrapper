import type { ScrapedJob } from '../../scraper.interface.js';
import { parseRelativeDate } from '../../../domain/job/relative-date-parser.js';

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanText(text?: string | null): string {
  if (!text) return '';
  return stripHtml(text);
}

export function detectLinkedInAuthWall(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  return (
    html.includes('authwall') ||
    html.includes('sign-in-form') ||
    html.includes('join-form') ||
    html.includes('checkpoint/lg/login') ||
    html.includes('checkpoint/challenge') ||
    html.includes('LinkedIn: Log In or Sign Up') ||
    html.includes('Please enter your details to sign in') ||
    html.includes('name="session_key"')
  );
}

function mapWorkMode(text?: string | null): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('remote') || lower.includes('wfh')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('wfo')) return 'onsite';
  return undefined;
}

export function parseLinkedInSearchPage(
  html: string,
  _baseUrl = 'https://www.linkedin.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  if (!html || typeof html !== 'string' || detectLinkedInAuthWall(html)) return [];

  const results: ScrapedJob[] = [];
  const cardChunks = html.split(/(?=<(?:div|li)[^>]*(?:data-entity-urn=["']urn:li:jobPosting:|\bbase-card\b|\bjob-search-card\b))/i);

  for (const cardHtml of cardChunks) {
    // Extract jobId
    const urnMatch = /data-entity-urn=["']urn:li:jobPosting:(\d+)["']/i.exec(cardHtml);
    const linkMatch = /\/jobs\/view\/(?:[a-zA-Z0-9-]+-)?(\d+)/i.exec(cardHtml);
    const jobId = urnMatch ? urnMatch[1] : linkMatch ? linkMatch[1] : undefined;

    if (!jobId) continue;

    const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;

    // Title
    const titleMatch =
      /<h3[^>]*class=["'][^"']*base-search-card__title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i.exec(cardHtml) ||
      /<a[^>]*class=["'][^"']*base-card__full-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const rawTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<span[^>]*class=["']sr-only["']>[\s\S]*?<\/span>/gi, '') : '';
    const title = cleanText(rawTitle);
    if (!title) continue;

    // Company
    const compMatch =
      /<h4[^>]*class=["'][^"']*base-search-card__subtitle[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i.exec(cardHtml);
    const company = cleanText(compMatch ? compMatch[1] : '') || 'Unknown Company';

    // Location
    const locMatch =
      /<span[^>]*class=["'][^"']*job-search-card__location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const location = locMatch ? cleanText(locMatch[1]) : undefined;

    // Work Mode
    const workMode = mapWorkMode(`${title} ${location ?? ''}`);

    // Published Date
    const timeMatch =
      /<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i.exec(cardHtml) ||
      /<time[^>]*>([\s\S]*?)<\/time>/i.exec(cardHtml);
    let publishedAt: string | undefined;
    if (timeMatch) {
      const dtAttr = timeMatch[1]?.trim();
      if (dtAttr && /^\d{4}-\d{2}-\d{2}$/.test(dtAttr)) {
        publishedAt = new Date(`${dtAttr}T00:00:00.000Z`).toISOString();
      } else {
        const textContent = cleanText(timeMatch[2] ?? timeMatch[1]);
        publishedAt = parseRelativeDate(textContent);
      }
    }

    results.push({
      title,
      company,
      location,
      jobUrl,
      externalId: jobId,
      source: 'linkedin',
      workMode,
      publishedAt,
      scrapedAt,
    });
  }

  return results;
}

export function parseLinkedInDetailPage(html: string): {
  description: string;
} {
  if (!html || typeof html !== 'string' || detectLinkedInAuthWall(html)) return { description: '' };

  const descMatch =
    /class=["'][^"']*show-more-less-html__markup[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*description__text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*core-section-container__content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);

  return {
    description: descMatch && descMatch[1] ? cleanText(descMatch[1]) : '',
  };
}
