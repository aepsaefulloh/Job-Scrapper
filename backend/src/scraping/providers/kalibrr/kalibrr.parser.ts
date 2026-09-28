import type { ScrapedJob } from '../../scraper.interface.js';
import { parseRelativeDate } from '../../../domain/job/relative-date-parser.js';
import type { KalibrrJobDoc, KalibrrNextData } from './kalibrr.types.js';

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

function parseSalary(salaryText?: string | null): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
} {
  if (!salaryText) return {};
  const cleaned = salaryText.replace(/,/g, '').replace(/\./g, '');
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
  if (lower.includes('remote') || lower.includes('work from home') || lower.includes('wfh')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('wfo') || lower.includes('office')) {
    return 'onsite';
  }
  return undefined;
}

function extractNextData(html: string): KalibrrNextData | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as KalibrrNextData;
  } catch {
    return null;
  }
}

export function parseKalibrrSearchPage(
  html: string,
  baseUrl = 'https://www.kalibrr.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  if (!html || typeof html !== 'string') return [];

  // 1. Try Next.js hydration payload
  const nextData = extractNextData(html);
  const jobsList = nextData?.props?.pageProps?.jobs;
  if (Array.isArray(jobsList) && jobsList.length > 0) {
    return jobsList
      .filter((j): j is KalibrrJobDoc & { name?: string; title?: string } => !!(j.name || j.title))
      .map((j) => {
        const title = cleanText(j.name || j.title);
        const company = cleanText(j.company_name) || 'Unknown Company';
        const locationParts = [j.city, j.country].filter(Boolean).map((s) => cleanText(String(s)));
        const location = locationParts.length > 0 ? locationParts.join(', ') : undefined;
        const workMode = mapWorkMode(j.work_arrangement);
        const externalId = j.id ? String(j.id) : undefined;

        let jobUrl = baseUrl;
        if (j.company_slug && j.job_slug && j.id) {
          jobUrl = new URL(`/c/${j.company_slug}/jobs/${j.id}/${j.job_slug}`, baseUrl).toString();
        } else if (j.id) {
          jobUrl = new URL(`/jobs/${j.id}`, baseUrl).toString();
        }

        return {
          title,
          company,
          location,
          jobUrl,
          externalId,
          source: 'kalibrr',
          workMode,
          salaryMin: j.salary_min ?? undefined,
          salaryMax: j.salary_max ?? undefined,
          salaryCurrency: j.currency || (j.salary_min ? 'IDR' : undefined),
          publishedAt: parseRelativeDate(j.created_at),
          scrapedAt,
        };
      });
  }

  // 2. Pure deterministic parsing of HTML cards
  const results: ScrapedJob[] = [];
  const cardChunks = html.split(/(?=<(?:div|article)[^>]*(?:job-card|JobPosting|job-item))/i);

  for (const cardHtml of cardChunks) {
    if (!/job-card|JobPosting|job-item/i.test(cardHtml)) continue;

    // Link & externalId
    const linkMatch = /href=["']([^"']*\/jobs\/[^"']+)["']/i.exec(cardHtml);
    if (!linkMatch || !linkMatch[1]) continue;
    const rawHref = linkMatch[1];
    const jobUrl = rawHref.startsWith('http') ? rawHref : new URL(rawHref, baseUrl).toString();

    // Extract ID (e.g. /jobs/98765/... or /jobs/98765)
    const idMatch = /\/jobs\/(\d+)/i.exec(rawHref);
    const externalId = idMatch ? idMatch[1] : undefined;

    // Title
    const titleMatch =
      /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/i.exec(cardHtml) ||
      /<a[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) continue;

    // Company
    const compMatch =
      /itemprop=["']hiringOrganization["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml) ||
      /class=["'][^"']*company[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|a)>/i.exec(cardHtml);
    const company = cleanText(compMatch ? compMatch[1] : '') || 'Unknown Company';

    // Location
    const locMatch =
      /itemprop=["']addressLocality["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml) ||
      /class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const location = locMatch ? cleanText(locMatch[1]) : undefined;

    // Work Mode
    const wmMatch =
      /class=["'][^"']*(?:work-mode|work-arrangement|workmode)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const workMode = mapWorkMode(wmMatch ? wmMatch[1] : location);

    // Salary
    const salMatch =
      /class=["'][^"']*salary[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const { salaryMin, salaryMax, salaryCurrency } = parseSalary(salMatch ? salMatch[1] : undefined);

    // Published At
    const dateMatch =
      /class=["'][^"']*(?:caption|posted|date)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
    const publishedAt = parseRelativeDate(dateMatch ? cleanText(dateMatch[1]) : undefined);

    results.push({
      title,
      company,
      location,
      jobUrl,
      externalId,
      source: 'kalibrr',
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

export function parseKalibrrDetailPage(html: string): {
  description: string;
  skills?: string[];
} {
  if (!html || typeof html !== 'string') return { description: '' };

  const descParts: string[] = [];

  const mainDesc =
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (mainDesc && mainDesc[1]) {
    descParts.push(cleanText(mainDesc[1]));
  }

  const respDesc = /itemprop=["']responsibilities["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (respDesc && respDesc[1]) {
    descParts.push(cleanText(respDesc[1]));
  }

  const qualDesc = /itemprop=["']qualifications["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (qualDesc && qualDesc[1]) {
    descParts.push(cleanText(qualDesc[1]));
  }

  // Extract skills / tags
  const skills: string[] = [];
  const tagRegex = /class=["'][^"']*(?:k-tag|skill)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const tag = cleanText(tagMatch[1]);
    if (tag && !skills.includes(tag)) skills.push(tag);
  }

  return {
    description: descParts.join('\n\n') || '',
    skills: skills.length > 0 ? skills : undefined,
  };
}
