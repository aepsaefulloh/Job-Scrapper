import type { ScrapedJob } from '../../scraper.interface.js';
import type {
  DeallsDetailJobData,
  DeallsDetailQueryState,
  DeallsJobDoc,
  DeallsNextData,
  DeallsQueryState,
} from './dealls.types.js';

function stripHtml(html: string): string {
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

function extractNextData<T>(html: string): T | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

function mapWorkMode(mode?: string): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (!mode) return undefined;
  const normalized = mode.toLowerCase();
  if (normalized.includes('remote')) return 'remote';
  if (normalized.includes('hybrid')) return 'hybrid';
  if (normalized.includes('site') || normalized === 'wfo') return 'onsite';
  return undefined;
}

function mapEmploymentType(types?: string[]): string | undefined {
  if (!types || types.length === 0) return undefined;
  const first = types[0]?.toLowerCase();
  if (!first) return undefined;
  if (first.includes('full') || first === 'fulltime') return 'full-time';
  if (first.includes('part') || first === 'parttime') return 'part-time';
  if (first.includes('contract') || first === 'kontrak') return 'contract';
  if (first.includes('intern') || first === 'magang') return 'internship';
  if (first.includes('free') || first === 'freelance') return 'freelance';
  return first;
}

function mapLocation(doc: DeallsJobDoc): string | undefined {
  const parts: string[] = [];
  if (doc.city?.name) parts.push(doc.city.name.trim());
  if (doc.country?.name) parts.push(doc.country.name.trim());
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function parseDeallsSearchPage(
  html: string,
  baseUrl = 'https://dealls.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  const nextData = extractNextData<DeallsNextData<DeallsQueryState>>(html);
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries;

  if (Array.isArray(queries)) {
    const jobDocs: DeallsJobDoc[] = [];
    for (const q of queries) {
      const pages = q.state?.data?.pages;
      if (Array.isArray(pages)) {
        for (const page of pages) {
          if (Array.isArray(page.docs)) {
            jobDocs.push(...page.docs);
          }
        }
      }
    }

    if (jobDocs.length > 0) {
      const seen = new Set<string>();
      const jobs: ScrapedJob[] = [];

      for (const doc of jobDocs) {
        if (!doc.id || seen.has(doc.id)) continue;
        seen.add(doc.id);

        const title = (doc.role || '').trim();
        if (!title) continue;

        const company = doc.company?.name?.trim() || undefined;
        const location = mapLocation(doc);
        const workMode = mapWorkMode(doc.workplaceType);
        const employmentType = mapEmploymentType(doc.employmentTypes);

        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        let salaryCurrency: string | undefined;

        if (doc.salaryRange) {
          if (typeof doc.salaryRange.min === 'number' && Number.isFinite(doc.salaryRange.min)) {
            salaryMin = doc.salaryRange.min;
          }
          if (typeof doc.salaryRange.max === 'number' && Number.isFinite(doc.salaryRange.max)) {
            salaryMax = doc.salaryRange.max;
          }
          if (doc.salaryRange.currency) {
            salaryCurrency = doc.salaryRange.currency.trim();
          }
        }

        let skills: string[] | undefined;
        if (Array.isArray(doc.skills) && doc.skills.length > 0) {
          const list = doc.skills.map((s) => s.name?.trim()).filter((s): s is string => Boolean(s));
          if (list.length > 0) skills = list;
        }

        const publishedAt = doc.publishedAt || doc.createdAt || undefined;

        // Canonical job URL: /loker/{slug}~{company.slug}
        const companySlug = doc.company?.slug ? `~${doc.company.slug}` : '';
        const jobUrl = new URL(`/loker/${doc.slug}${companySlug}`, baseUrl).toString();

        jobs.push({
          source: 'dealls',
          externalId: doc.id,
          title,
          ...(company ? { company } : {}),
          ...(location ? { location } : {}),
          ...(workMode ? { workMode } : {}),
          ...(employmentType ? { employmentType } : {}),
          ...(salaryMin !== undefined ? { salaryMin } : {}),
          ...(salaryMax !== undefined ? { salaryMax } : {}),
          ...(salaryCurrency ? { salaryCurrency } : {}),
          ...(skills && skills.length > 0 ? { skills } : {}),
          jobUrl,
          ...(publishedAt ? { publishedAt } : {}),
          scrapedAt,
        });
      }

      if (jobs.length > 0) {
        return jobs;
      }
    }
  }

  // Fallback regex parsing on DOM anchor tags matching /loker/
  const linkRegex = /href=["'](\/loker\/([a-zA-Z0-9_\-~]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawPath = match[1];
    const slug = match[2];
    const innerHtml = match[3];

    // Filter out top-level /loker root links and undefined matches
    if (!rawPath || !slug || slug === 'loker' || slug.startsWith('?') || !innerHtml) continue;

    const jobUrl = new URL(rawPath, baseUrl).toString();
    if (seenUrls.has(jobUrl)) continue;
    seenUrls.add(jobUrl);

    const title = stripHtml(innerHtml);
    if (!title || title.length < 2 || title.toLowerCase() === 'loker') continue;

    jobs.push({
      source: 'dealls',
      externalId: slug,
      title,
      jobUrl,
      scrapedAt,
    });
  }

  return jobs;
}

export function parseDeallsDetailPage(html: string): string | undefined {
  const nextData = extractNextData<DeallsNextData<DeallsDetailQueryState>>(html);
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries;

  if (Array.isArray(queries)) {
    for (const q of queries) {
      const data: DeallsDetailJobData | undefined = q.state?.data;
      if (data && (data.responsibilities || data.requirements || data.description)) {
        if (data.description && stripHtml(data.description).length > 10) {
          return stripHtml(data.description);
        }

        const sections: string[] = [];
        if (data.responsibilities) {
          const resp = stripHtml(data.responsibilities);
          if (resp) sections.push(`Responsibilities:\n${resp}`);
        }
        if (data.requirements) {
          const reqs = stripHtml(data.requirements);
          if (reqs) sections.push(`Requirements:\n${reqs}`);
        }
        if (data.perks && data.perks.length > 0) {
          sections.push(`Perks:\n${data.perks.join(', ')}`);
        }

        if (sections.length > 0) {
          return sections.join('\n\n');
        }
      }
    }
  }

  // Fallback: look for description container in DOM
  const descMatch = /<div[^>]*class=["'][^"']*(?:job-description|description|responsibilities)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
    html
  );
  if (descMatch?.[1]) {
    const text = stripHtml(descMatch[1]);
    if (text.length > 10) return text;
  }

  return undefined;
}
