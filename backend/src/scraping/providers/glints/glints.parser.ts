import type { ScrapedJob } from '../../scraper.interface.js';
import type {
  GlintsDetailPageProps,
  GlintsDraftJsData,
  GlintsJobInPage,
  GlintsSearchPageProps,
} from './glints.types.js';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
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

function mapWorkMode(
  option?: string,
  isRemote?: boolean
): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (isRemote || option?.toUpperCase() === 'REMOTE') return 'remote';
  if (option?.toUpperCase() === 'HYBRID') return 'hybrid';
  if (option?.toUpperCase() === 'ONSITE' || option?.toUpperCase() === 'WFO') return 'onsite';
  return undefined;
}

function mapEmploymentType(type?: string): string | undefined {
  if (!type) return undefined;
  switch (type.toUpperCase()) {
    case 'FULL_TIME':
      return 'full-time';
    case 'PART_TIME':
      return 'part-time';
    case 'CONTRACT':
      return 'contract';
    case 'INTERNSHIP':
      return 'internship';
    case 'FREELANCE':
      return 'freelance';
    default:
      return type.toLowerCase().replace(/_/g, '-');
  }
}

function mapLocation(job: GlintsJobInPage): string | undefined {
  if (job.formattedLocation) return job.formattedLocation.trim();
  if (job.location?.formattedName) return job.location.formattedName.trim();
  if (job.location?.name) return job.location.name.trim();
  if (job.city?.name) return job.city.name.trim();
  if (typeof job.country === 'string') return job.country.trim();
  if (job.country?.name) return job.country.name.trim();
  return undefined;
}

function mapCompany(company?: GlintsJobInPage['company']): string | undefined {
  if (!company) return undefined;
  if (typeof company === 'string') return company.trim() || undefined;
  return company.name?.trim() || undefined;
}

function mapDraftJsText(jsonString: string): string | undefined {
  try {
    const draft = JSON.parse(jsonString) as GlintsDraftJsData;
    if (!draft.blocks || !Array.isArray(draft.blocks)) return undefined;
    const lines = draft.blocks
      .map((b) => (typeof b.text === 'string' ? b.text.trim() : ''))
      .filter((t) => t.length > 0);
    return lines.length > 0 ? lines.join('\n') : undefined;
  } catch {
    return undefined;
  }
}

export function parseGlintsSearchPage(
  html: string,
  baseUrl = 'https://glints.com',
  scrapedAt = new Date().toISOString()
): ScrapedJob[] {
  const nextData = extractNextData<GlintsSearchPageProps>(html);
  const jobsInPage = nextData?.props?.pageProps?.initialJobs?.jobsInPage;

  if (Array.isArray(jobsInPage) && jobsInPage.length > 0) {
    return jobsInPage.map((job): ScrapedJob => {
      const externalId = job.id;
      const title = (job.title || '').trim();
      const company = mapCompany(job.company);
      const location = mapLocation(job);
      const workMode = mapWorkMode(job.workArrangementOption, job.isRemote);
      const employmentType = mapEmploymentType(job.type);

      let salaryMin: number | undefined;
      let salaryMax: number | undefined;
      let salaryCurrency: string | undefined;

      if (job.shouldShowSalary !== false && Array.isArray(job.salaries) && job.salaries.length > 0) {
        const salary = job.salaries[0];
        if (salary && typeof salary.minAmount === 'number' && Number.isFinite(salary.minAmount)) {
          salaryMin = salary.minAmount;
        }
        if (salary && typeof salary.maxAmount === 'number' && Number.isFinite(salary.maxAmount)) {
          salaryMax = salary.maxAmount;
        }
        if (salary) {
          salaryCurrency = salary.CurrencyCode || salary.currencyCode || undefined;
        }
      }

      let skills: string[] | undefined;
      if (Array.isArray(job.skills) && job.skills.length > 0) {
        const extracted = job.skills
          .map((s) => s.skill?.name || s.name || '')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (extracted.length > 0) {
          skills = extracted;
        }
      }

      const publishedAt = job.createdAt || job.updatedAt || undefined;
      const jobUrl = new URL(`/id/opportunities/jobs/${externalId}`, baseUrl).toString();

      return {
        source: 'glints',
        externalId,
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
        metadata: {
          ...(job.status ? { status: job.status } : {}),
          ...(job.educationLevel ? { educationLevel: job.educationLevel } : {}),
          ...(job.isHot !== undefined ? { isHot: job.isHot } : {}),
        },
      };
    });
  }

  // Fallback DOM regex parser if __NEXT_DATA__ is absent or missing jobs
  const linkRegex = /href=["'](\/id\/opportunities\/jobs\/([a-zA-Z0-9_-]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawPath = match[1];
    const externalId = match[2];
    const innerHtml = match[3];
    if (!rawPath || !externalId || !innerHtml) continue;

    const jobUrl = new URL(rawPath, baseUrl).toString();

    if (seenUrls.has(jobUrl)) continue;
    seenUrls.add(jobUrl);

    const title = stripHtml(innerHtml);
    if (!title || title.length < 2) continue;

    jobs.push({
      source: 'glints',
      externalId,
      title,
      jobUrl,
      scrapedAt,
    });
  }

  return jobs;
}

export function parseGlintsDetailPage(html: string): string | undefined {
  const nextData = extractNextData<GlintsDetailPageProps>(html);
  const data = nextData?.props?.pageProps?.initialData?.data;

  if (data?.descriptionJsonString) {
    const text = mapDraftJsText(data.descriptionJsonString);
    if (text) return text;
  }

  // Fallback: look for description in HTML elements
  const descContainerMatch = /<div[^>]*class=["'][^"']*(?:JobDescription|description|job-details)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (descContainerMatch?.[1]) {
    const text = stripHtml(descContainerMatch[1]);
    if (text.length > 10) return text;
  }

  return undefined;
}
