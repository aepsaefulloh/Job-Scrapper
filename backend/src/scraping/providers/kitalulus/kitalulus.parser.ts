import type { ScrapedJob } from '../../scraper.interface.js';
import { parseRelativeDate } from '../../../domain/job/relative-date-parser.js';
import type { KitaLulusNextData, KitaLulusVacancy } from './kitalulus.types.js';

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
  const matches = [...cleaned.matchAll(/(\d{5,10})/g)];
  if (matches.length >= 2 && matches[0] && matches[1]) {
    const min = parseInt(matches[0][1] ?? '0', 10);
    const max = parseInt(matches[1][1] ?? '0', 10);
    return {
      salaryMin: min > 0 ? min : undefined,
      salaryMax: max > 0 ? max : undefined,
      salaryCurrency: salaryText.toLowerCase().includes('rp') ? 'IDR' : undefined,
    };
  }
  if (matches.length === 1 && matches[0]) {
    const amount = parseInt(matches[0][1] ?? '0', 10);
    return {
      salaryMin: amount > 0 ? amount : undefined,
      salaryCurrency: salaryText.toLowerCase().includes('rp') ? 'IDR' : undefined,
    };
  }
  return {};
}

function mapWorkMode(text?: string | null): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('remote') || lower.includes('wfh')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('onsite') || lower.includes('wfo') || lower.includes('kantor')) return 'onsite';
  return undefined;
}

function mapEmploymentType(
  text?: string | null
): 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('full') || lower.includes('penuh')) return 'full-time';
  if (lower.includes('part') || lower.includes('paruh')) return 'part-time';
  if (lower.includes('contract') || lower.includes('kontrak')) return 'contract';
  if (lower.includes('intern') || lower.includes('magang')) return 'internship';
  if (lower.includes('free') || lower.includes('lepas')) return 'freelance';
  return undefined;
}

function extractNextData(html: string): KitaLulusNextData | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as KitaLulusNextData;
  } catch {
    return null;
  }
}

export function parseKitaLulusSearchPage(
  html: string,
  baseUrl = 'https://kerja.kitalulus.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  if (!html || typeof html !== 'string') return [];

  // 1. Try extracting from Next.js hydration payload if present
  const nextData = extractNextData(html);
  const vacancies = nextData?.props?.pageProps?.initialState?.vacancies;
  if (Array.isArray(vacancies) && vacancies.length > 0) {
    return vacancies
      .filter((v): v is KitaLulusVacancy & { title: string } => !!v.title)
      .map((v) => {
        const id = v.id || v.slug || '';
        const url = v.slug
          ? new URL(`/id/lowongan/${v.slug}`, baseUrl).toString()
          : new URL(`/id/lowongan/${id}`, baseUrl).toString();

        return {
          title: cleanText(v.title),
          company: cleanText(v.company_name) || 'Unknown Company',
          location: v.city ? cleanText(v.city) : undefined,
          jobUrl: url,
          externalId: id || undefined,
          source: 'kitalulus',
          workMode: mapWorkMode(v.work_arrangement),
          employmentType: mapEmploymentType(v.employment_type),
          salaryMin: v.salary_min ?? undefined,
          salaryMax: v.salary_max ?? undefined,
          salaryCurrency: v.salary_currency || (v.salary_min ? 'IDR' : undefined),
          publishedAt: parseRelativeDate(v.created_at),
          description: v.description ? cleanText(v.description) : undefined,
          scrapedAt,
        };
      });
  }

  // 2. Pure deterministic regex parsing of HTML cards
  const results: ScrapedJob[] = [];
  const cardRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardHtml = cardMatch[1];
    if (!cardHtml) continue;

    // Link & externalId
    const linkMatch = /href=["']([^"']*\/id\/lowongan\/[^"']+)["']/i.exec(cardHtml);
    if (!linkMatch || !linkMatch[1]) continue;
    const rawHref = linkMatch[1];
    const jobUrl = rawHref.startsWith('http') ? rawHref : new URL(rawHref, baseUrl).toString();
    const externalId = rawHref.split('/lowongan/')[1]?.split('?')[0] || undefined;

    // Title
    const titleMatch = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(cardHtml) ||
      /<a[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml);
    const title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) continue;

    // Company
    const compMatch = /class=["'][^"']*company[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p|a)>/i.exec(cardHtml);
    const company = cleanText(compMatch ? compMatch[1] : '') || 'Unknown Company';

    // Location
    const locMatch = /class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const location = locMatch ? cleanText(locMatch[1]) : undefined;

    // Salary
    const salMatch = /class=["'][^"']*salary[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const { salaryMin, salaryMax, salaryCurrency } = parseSalary(salMatch ? salMatch[1] : undefined);

    // Work Mode
    const wmMatch = /class=["'][^"']*(?:work-mode|workmode)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const workMode = mapWorkMode(wmMatch ? wmMatch[1] : location);

    // Published At
    const dateMatch = /class=["'][^"']*(?:posted|time|date)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i.exec(cardHtml);
    const publishedAt = parseRelativeDate(dateMatch ? cleanText(dateMatch[1]) : undefined);

    results.push({
      title,
      company,
      location,
      jobUrl,
      externalId,
      source: 'kitalulus',
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

export function parseKitaLulusDetailPage(html: string): {
  description: string;
  requirements?: string[];
  skills?: string[];
} {
  if (!html || typeof html !== 'string') return { description: '' };

  // 1. Check if description is in Next.js props
  const nextData = extractNextData(html);
  const vac = nextData?.props?.pageProps?.vacancy;
  if (vac?.description) {
    return {
      description: cleanText(vac.description),
      requirements: Array.isArray(vac.requirements) ? vac.requirements.map(cleanText) : undefined,
      skills: Array.isArray(vac.skills) ? vac.skills.map(cleanText) : undefined,
    };
  }

  // 2. Regex fallback for detail page
  const descParts: string[] = [];
  const descMatch = /class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (descMatch && descMatch[1]) {
    descParts.push(cleanText(descMatch[1]));
  }

  const reqMatch = /class=["'][^"']*job-requirements[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (reqMatch && reqMatch[1]) {
    descParts.push(cleanText(reqMatch[1]));
  }

  // If no specific class found, extract from any main container
  if (descParts.length === 0) {
    const mainMatch = /class=["'][^"']*job-detail[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    if (mainMatch && mainMatch[1]) {
      descParts.push(cleanText(mainMatch[1]));
    }
  }

  // Extract skills / tags
  const skills: string[] = [];
  const skillRegex = /class=["'][^"']*(?:skill-tag|tag)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|a|div)>/gi;
  let skMatch: RegExpExecArray | null;
  while ((skMatch = skillRegex.exec(html)) !== null) {
    const tag = cleanText(skMatch[1]);
    if (tag && !skills.includes(tag)) skills.push(tag);
  }

  return {
    description: descParts.join('\n\n') || '',
    skills: skills.length > 0 ? skills : undefined,
  };
}
