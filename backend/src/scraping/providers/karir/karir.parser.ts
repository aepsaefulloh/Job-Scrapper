import type { ScrapedJob } from '../../scraper.interface.js';
import { parseRelativeDate } from '../../../domain/job/relative-date-parser.js';
import type { KarirNextData, KarirOpportunityDoc, KarirApiOpportunity, KarirApiDetailData } from './karir.types.js';

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

function extractNextData(html: string): KarirNextData | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as KarirNextData;
  } catch {
    return null;
  }
}

export function parseKarirSearchPage(
  html: string,
  baseUrl = 'https://karir.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  if (!html || typeof html !== 'string') return [];

  // 1. Try Next.js hydration payload
  const nextData = extractNextData(html);
  const oppsList = nextData?.props?.pageProps?.opportunities;
  if (Array.isArray(oppsList) && oppsList.length > 0) {
    return oppsList
      .filter((o): o is KarirOpportunityDoc & { title?: string; name?: string } => !!(o.title || o.name))
      .map((o) => {
        const title = cleanText(o.title || o.name);
        const company = cleanText(o.company?.name) || 'Unknown Company';
        const location = cleanText(o.location?.name || o.location?.city) || undefined;
        const externalId = o.id ? String(o.id) : undefined;
        const slug = o.slug || (o.id ? String(o.id) : '');
        const jobUrl = slug ? new URL(`/opportunities/${slug}`, baseUrl).toString() : baseUrl;

        return {
          title,
          company,
          location,
          jobUrl,
          externalId,
          source: 'karir',
          salaryMin: o.salary_min ?? undefined,
          salaryMax: o.salary_max ?? undefined,
          salaryCurrency: o.currency || (o.salary_min ? 'IDR' : undefined),
          publishedAt: parseRelativeDate(o.created_at || o.posted_at),
          scrapedAt,
        };
      });
  }

  // 2. Pure deterministic parsing of HTML cards
  const results: ScrapedJob[] = [];
  const cardChunks = html.split(/(?=<(?:div|article)[^>]*(?:opportunity-card|job-card|search-item))/i);

  for (const cardHtml of cardChunks) {
    if (!/opportunity-card|job-card|search-item/i.test(cardHtml)) continue;

    // Link & externalId
    const linkMatch = /href=["']([^"']*\/opportunities\/[^"']+)["']/i.exec(cardHtml);
    if (!linkMatch || !linkMatch[1]) continue;
    const rawHref = linkMatch[1];
    const jobUrl = rawHref.startsWith('http') ? rawHref : new URL(rawHref, baseUrl).toString();

    // Extract ID (e.g. /opportunities/10101-accounting-officer or /opportunities/10101)
    const idMatch = /\/opportunities\/(\d+)/i.exec(rawHref);
    const externalId = idMatch ? idMatch[1] : undefined;

    // Title
    const titleMatch =
      /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/i.exec(cardHtml) ||
      /<a[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) continue;

    // Company
    const compMatch =
      /class=["'][^"']*company[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml) ||
      /href=["'][^"']*\/companies\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const company = cleanText(compMatch ? compMatch[1] : '') || 'Unknown Company';

    // Location
    const locMatch =
      /class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const location = locMatch ? cleanText(locMatch[1]) : undefined;

    // Salary
    const salMatch =
      /class=["'][^"']*salary[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const { salaryMin, salaryMax, salaryCurrency } = parseSalary(salMatch ? salMatch[1] : undefined);

    // Published At (strip 'tayang' if present)
    const dateMatch =
      /class=["'][^"']*(?:posting-date|posted|date|time)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i.exec(cardHtml);
    const rawDate = dateMatch ? cleanText(dateMatch[1]).replace(/^tayang\s+/i, '') : undefined;
    const publishedAt = parseRelativeDate(rawDate);

    results.push({
      title,
      company,
      location,
      jobUrl,
      externalId,
      source: 'karir',
      salaryMin,
      salaryMax,
      salaryCurrency,
      publishedAt,
      scrapedAt,
    });
  }

  return results;
}

export function parseKarirDetailPage(html: string): {
  description: string;
  skills?: string[];
} {
  if (!html || typeof html !== 'string') return { description: '' };

  const descParts: string[] = [];

  const mainDesc =
    /class=["'][^"']*opportunity-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (mainDesc && mainDesc[1]) {
    descParts.push(cleanText(mainDesc[1]));
  }

  const reqDesc =
    /class=["'][^"']*opportunity-requirements[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /class=["'][^"']*requirements-section[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (reqDesc && reqDesc[1]) {
    descParts.push(cleanText(reqDesc[1]));
  }

  // Extract skills / tags
  const skills: string[] = [];
  const tagRegex = /class=["'][^"']*(?:tag-skill|skill)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|a|div)>/gi;
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

export function parseKarirApiOpportunity(
  item: KarirApiOpportunity,
  baseUrl = 'https://karir.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob {
  const title = cleanText(item.job_position || item.title || item.name || '');
  const company = cleanText(
    item.company_name ||
      (typeof item.company === 'object' && item.company !== null
        ? (item.company as { name?: string }).name
        : '') ||
      'Unknown Company'
  );
  const location = cleanText(
    item.description ||
      (typeof item.location === 'object' && item.location !== null
        ? (item.location as { name?: string }).name
        : '')
  ) || undefined;

  const externalId = item.id ? String(item.id) : undefined;
  const slug = item.slug || (item.id ? String(item.id) : '');
  const jobUrl = slug ? new URL(`/opportunities/${slug}`, baseUrl).toString() : baseUrl;

  const min =
    typeof item.salary_lower === 'number'
      ? item.salary_lower
      : typeof item.salary_min === 'number'
      ? item.salary_min
      : undefined;
  const max =
    typeof item.salary_upper === 'number'
      ? item.salary_upper
      : typeof item.salary_max === 'number'
      ? item.salary_max
      : undefined;

  return {
    title,
    company,
    location,
    jobUrl,
    externalId,
    source: 'karir',
    salaryMin: min,
    salaryMax: max,
    salaryCurrency: min ? 'IDR' : undefined,
    publishedAt: parseRelativeDate(item.posted_at || item.created_at),
    scrapedAt,
  };
}

export function parseKarirApiDetail(detail: KarirApiDetailData): {
  description: string;
  skills?: string[];
} {
  const descParts: string[] = [];
  if (detail.responsibilities) {
    const cleaned = cleanText(detail.responsibilities);
    if (cleaned) descParts.push(cleaned);
  }
  if (detail.requirements) {
    const cleaned = cleanText(detail.requirements);
    if (cleaned) descParts.push(cleaned);
  }

  const skills: string[] = [];
  if (Array.isArray(detail.required_skills)) {
    for (const item of detail.required_skills) {
      const name = typeof item === 'string' ? item : item?.name || item?.skill_name;
      if (name && typeof name === 'string') {
        const cleaned = cleanText(name);
        if (cleaned && !skills.includes(cleaned)) {
          skills.push(cleaned);
        }
      }
    }
  }

  return {
    description: descParts.join('\n\n') || '',
    skills: skills.length > 0 ? skills : undefined,
  };
}

