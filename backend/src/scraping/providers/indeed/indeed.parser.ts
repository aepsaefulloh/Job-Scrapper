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

export function detectIndeedChallenge(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  return (
    html.includes('cf-browser-verification') ||
    html.includes('cf-im-under-attack') ||
    html.includes('challenge-running') ||
    html.includes('Checking your browser before accessing indeed.com') ||
    html.includes('Attention Required! | Cloudflare') ||
    html.includes('Verifying you are human')
  );
}

function parseSalary(salaryText?: string | null): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
} {
  if (!salaryText) return {};
  const cleaned = salaryText.replace(/\./g, '').replace(/,/g, '');
  const matches = [...cleaned.matchAll(/(\d{6,11})/g)];
  const isIdr = /idr|rp/i.test(salaryText);

  if (matches.length >= 2 && matches[0] && matches[1]) {
    const min = parseInt(matches[0][1] ?? '0', 10);
    const max = parseInt(matches[1][1] ?? '0', 10);
    return {
      salaryMin: min > 0 ? min : undefined,
      salaryMax: max > 0 ? max : undefined,
      salaryCurrency: isIdr ? 'IDR' : undefined,
    };
  }
  if (matches.length === 1 && matches[0]) {
    const amount = parseInt(matches[0][1] ?? '0', 10);
    return {
      salaryMin: amount > 0 ? amount : undefined,
      salaryCurrency: isIdr ? 'IDR' : undefined,
    };
  }
  return {};
}

function mapWorkMode(text?: string | null): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('remote') || lower.includes('wfh')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('wfo')) return 'onsite';
  return undefined;
}

export function parseIndeedSearchPage(
  html: string,
  baseUrl = 'https://id.indeed.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  if (!html || typeof html !== 'string' || detectIndeedChallenge(html)) return [];

  const results: ScrapedJob[] = [];
  const cardChunks = html.split(/(?=<(?:li|div)[^>]*(?:cardOutline|job_seen_beacon|tapItem|data-jk))/i);

  for (const cardHtml of cardChunks) {
    // Extract jobKey (jk)
    const jkMatch = /data-jk=["']([a-zA-Z0-9]+)["']/i.exec(cardHtml) ||
      /jk=([a-zA-Z0-9]+)/i.exec(cardHtml);
    if (!jkMatch || !jkMatch[1]) continue;
    const jk = jkMatch[1];

    // Canonical URL
    const jobUrl = new URL(`/viewjob?jk=${jk}`, baseUrl).toString();

    // Title
    const titleMatch =
      /<h2[^>]*class=["'][^"']*jobTitle[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i.exec(cardHtml) ||
      /<a[^>]*class=["'][^"']*jcs-JobTitle[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) continue;

    // Company
    const compMatch =
      /data-testid=["']company-name["'][^>]*>([\s\S]*?)<\/(?:span|div|a)>/i.exec(cardHtml) ||
      /class=["'][^"']*companyName[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|a)>/i.exec(cardHtml);
    const company = cleanText(compMatch ? compMatch[1] : '') || 'Unknown Company';

    // Location
    const locMatch =
      /data-testid=["']text-location["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i.exec(cardHtml) ||
      /class=["'][^"']*companyLocation[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i.exec(cardHtml);
    const location = locMatch ? cleanText(locMatch[1]) : undefined;

    // Work Mode
    const workMode = mapWorkMode(`${title} ${location ?? ''}`);

    // Salary
    const salMatch =
      /class=["'][^"']*(?:salary-snippet|attribute_snippet)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i.exec(cardHtml);
    const { salaryMin, salaryMax, salaryCurrency } = parseSalary(salMatch ? salMatch[1] : undefined);

    // Published At
    const dateMatch =
      /class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const publishedAt = parseRelativeDate(dateMatch ? cleanText(dateMatch[1]) : undefined);

    results.push({
      title,
      company,
      location,
      jobUrl,
      externalId: jk,
      source: 'indeed',
      workMode,
      salaryMin,
      salaryMax,
      salaryCurrency,
      publishedAt,
      scrapedAt,
    });
  }

  return results;
}

export function parseIndeedDetailPage(html: string): {
  description: string;
} {
  if (!html || typeof html !== 'string') return { description: '' };

  const descMatch =
    /id=["']jobDescriptionText["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*jobsearch-JobComponent-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);

  return {
    description: descMatch && descMatch[1] ? cleanText(descMatch[1]) : '',
  };
}
