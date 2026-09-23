import type { ScrapedJob } from '../../scraper.interface.js';
import type {
  LokerIdDetailJob,
  LokerIdDetailRouteData,
  LokerIdJobItem,
  LokerIdPaginationMeta,
  LokerIdRemixContext,
  LokerIdSearchRouteData,
} from './loker-id.types.js';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#8211;': '–',
  '&#8212;': '—',
  '&bull;': '•',
};

export function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&(?:amp|nbsp|lt|gt|quot|#39|apos|#8211|#8212|bull);/g, (match) => {
    return HTML_ENTITY_MAP[match] ?? match;
  });
}

export function cleanHtmlToText(html: string): string {
  if (!html) return '';
  const withListBullets = html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n');

  const stripped = withListBullets.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(stripped);

  // Normalize linebreaks and whitespace
  return decoded
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && (arr[idx - 1]?.length ?? 0) > 0))
    .join('\n')
    .trim();
}

export function normalizeLokerIdEmploymentType(type?: string | null): string | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase().trim();
  if (t.includes('penuh') || t.includes('full') || t === 'purna-waktu') return 'full-time';
  if (t.includes('paruh') || t.includes('part')) return 'part-time';
  if (t.includes('kontrak') || t.includes('contract')) return 'contract';
  if (t.includes('magang') || t.includes('intern')) return 'internship';
  if (t.includes('freelance') || t.includes('lepas')) return 'freelance';
  return t;
}

export function normalizeLokerIdWorkMode(
  isRemote?: boolean,
  locationType?: { name?: string; slug?: string } | null
): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  if (isRemote) return 'remote';
  const str = `${locationType?.name ?? ''} ${locationType?.slug ?? ''}`.toLowerCase();
  if (str.includes('remote') || str.includes('jarak jauh')) return 'remote';
  if (str.includes('hibrida') || str.includes('hybrid')) return 'hybrid';
  if (str.includes('dikantor') || str.includes('onsite') || str.includes('on-site') || str.includes('kantor')) return 'onsite';
  return 'unknown';
}

export function extractRemixContext(html: string): LokerIdRemixContext | null {
  const match = /window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i.exec(html);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as LokerIdRemixContext;
  } catch {
    return null;
  }
}

export function parseLokerIdSearchPage(
  html: string,
  baseUrl = 'https://www.loker.id',
  scrapedAt = new Date().toISOString()
): { jobs: ScrapedJob[]; pagination: LokerIdPaginationMeta } {
  const remix = extractRemixContext(html);
  const loaderData = remix?.state?.loaderData ?? {};

  // Find the search route data
  let searchData: LokerIdSearchRouteData | undefined;
  for (const [key, val] of Object.entries(loaderData)) {
    if (key.includes('cari-lowongan-kerja') && val && typeof val === 'object' && 'jobs' in val) {
      searchData = val as LokerIdSearchRouteData;
      break;
    }
  }

  // Also collect URL map from Schema.org ItemList if available (by position)
  const schemaUrlMap = new Map<number, string>();
  const schemaRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let schemaMatch: RegExpExecArray | null;
  while ((schemaMatch = schemaRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(schemaMatch[1] ?? '{}');
      const itemList = parsed?.mainEntity?.itemListElement ?? parsed?.itemListElement;
      if (Array.isArray(itemList)) {
        for (const item of itemList) {
          if (typeof item?.position === 'number' && item?.url) {
            schemaUrlMap.set(item.position, item.url);
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in script tags
    }
  }

  const pagination: LokerIdPaginationMeta = {
    current_page: searchData?.meta?.current_page ?? 1,
    last_page: searchData?.meta?.last_page ?? 1,
    per_page: searchData?.meta?.per_page ?? 21,
    total: searchData?.meta?.total ?? searchData?.jobs?.length ?? 0,
  };

  if (searchData?.jobs && Array.isArray(searchData.jobs)) {
    const jobs: ScrapedJob[] = searchData.jobs.map((item: LokerIdJobItem, index: number) => {
      // Determine canonical job URL by Schema position first, then category/slug
      let jobUrl = schemaUrlMap.get(index + 1);
      if (!jobUrl && item.slug) {
        const cat = item.categories?.[0];
        if (cat?.parent?.slug && cat?.slug) {
          jobUrl = new URL(`/${cat.parent.slug}/${cat.slug}/${item.slug}.html`, baseUrl).toString();
        } else if (cat?.slug) {
          jobUrl = new URL(`/${cat.slug}/${item.slug}.html`, baseUrl).toString();
        } else {
          jobUrl = new URL(`/cari-lowongan-kerja?jobid=${item.id}`, baseUrl).toString();
        }
      }
      if (!jobUrl) {
        jobUrl = new URL(`/cari-lowongan-kerja?jobid=${item.id}`, baseUrl).toString();
      }

      const employmentType =
        normalizeLokerIdEmploymentType(item.job_type) ??
        normalizeLokerIdEmploymentType(item.types?.[0]?.name);

      const workMode = normalizeLokerIdWorkMode(item.is_remote, item.job_location_type);

      const skills = (item.job_skills ?? [])
        .map((s) => s.name?.trim())
        .filter((s): s is string => !!s && s.length > 0);

      // Search-level description fallback so ingestion does not fail if detail page is unreachable
      const summaryDescriptionParts = [
        cleanHtmlToText(item.title),
        item.company_name ? `Perusahaan: ${cleanHtmlToText(item.company_name)}` : null,
        item.location ? `Lokasi: ${cleanHtmlToText(item.location)}` : null,
        item.job_salary ? `Gaji: ${item.job_salary}` : null,
        item.job_benefits ? `Benefit: ${cleanHtmlToText(item.job_benefits)}` : null,
        item.job_experience ? `Pengalaman: ${item.job_experience}` : null,
      ].filter(Boolean);
      const summaryDescription = summaryDescriptionParts.join('\n');

      // Only assign numeric salary if salary is not hidden and values are defined
      let salaryMin: number | undefined;
      let salaryMax: number | undefined;
      let salaryCurrency: string | undefined;

      if (!item.is_hide_salary) {
        if (typeof item.salary_min === 'number' && item.salary_min > 0) {
          salaryMin = item.salary_min;
          salaryCurrency = 'IDR';
        }
        if (typeof item.salary_max === 'number' && item.salary_max > 0) {
          salaryMax = item.salary_max;
          salaryCurrency = 'IDR';
        }
      }

      const scraped: ScrapedJob = {
        source: 'loker-id',
        externalId: String(item.id),
        title: cleanHtmlToText(item.title),
        ...(item.company_name ? { company: cleanHtmlToText(item.company_name) } : {}),
        ...(item.location ? { location: cleanHtmlToText(item.location) } : {}),
        description: summaryDescription || cleanHtmlToText(item.title),
        workMode,
        ...(employmentType ? { employmentType } : {}),
        ...(salaryMin !== undefined ? { salaryMin } : {}),
        ...(salaryMax !== undefined ? { salaryMax } : {}),
        ...(salaryCurrency ? { salaryCurrency } : {}),
        ...(skills.length > 0 ? { skills } : {}),
        jobUrl,
        ...(item.published_at ? { publishedAt: new Date(item.published_at.replace(' ', 'T')).toISOString() } : {}),
        scrapedAt,
        metadata: {
          slug: item.slug,
          companySlug: item.company_slug ?? undefined,
          jobSalaryRaw: item.job_salary ?? undefined,
          benefits: item.job_benefits ?? undefined,
          experience: item.job_experience ?? undefined,
        },
      };

      return scraped;
    });

    return { jobs, pagination };
  }

  // Fallback: DOM parsing if Remix context is absent
  const jobs: ScrapedJob[] = [];
  const cardRegex = /<a[^>]+href=["']([^"']*(?:jobid=\d+|[a-z0-9-]+\.html))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  const seenUrls = new Set<string>();

  while ((match = cardRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const linkContent = match[2] ?? '';
    if (!rawHref) continue;
    const href = new URL(rawHref, baseUrl).toString();
    if (seenUrls.has(href)) continue;
    seenUrls.add(href);

    const titleMatch = /<h\d[^>]*>([\s\S]*?)<\/h\d>/i.exec(linkContent);
    const title = titleMatch ? cleanHtmlToText(titleMatch[1] ?? '') : cleanHtmlToText(linkContent);
    if (!title || title.length < 3 || title.toLowerCase() === 'rincian') continue;

    const idMatch = /jobid=(\d+)/i.exec(href) || /(\d+)\.html/i.exec(href);
    const externalId = idMatch?.[1];

    jobs.push({
      source: 'loker-id',
      ...(externalId ? { externalId } : {}),
      title,
      jobUrl: href,
      workMode: 'unknown',
      scrapedAt,
    });
  }

  return { jobs, pagination };
}

export function parseLokerIdDetailPage(html: string): {
  description: string;
  requirements?: string;
  skills?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  workMode?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  employmentType?: string;
} | null {
  const remix = extractRemixContext(html);
  const loaderData = remix?.state?.loaderData ?? {};

  let detailRoute: LokerIdDetailRouteData | undefined;
  for (const [key, val] of Object.entries(loaderData)) {
    if (val && typeof val === 'object' && ('job' in val || 'jobslug' in val)) {
      detailRoute = val as LokerIdDetailRouteData;
      break;
    }
  }

  const job = detailRoute?.job;

  if (job) {
    const sections: string[] = [];

    const jobDescText = cleanHtmlToText(job.job_description || job.content || '');
    if (jobDescText) {
      sections.push(jobDescText);
    }

    const respText = cleanHtmlToText(job.responsibilities || '');
    if (respText) {
      sections.push(`Tanggung Jawab:\n${respText}`);
    }

    const qualText = cleanHtmlToText(job.qualifications || '');
    if (qualText) {
      sections.push(`Kualifikasi:\n${qualText}`);
    }

    if (sections.length === 0 && job.ld_json?.description) {
      sections.push(cleanHtmlToText(job.ld_json.description));
    }

    const description = sections.join('\n\n').trim();

    let salaryMin: number | undefined;
    let salaryMax: number | undefined;
    let salaryCurrency: string | undefined;

    if (!job.is_hide_salary) {
      if (typeof job.salary_min === 'number' && job.salary_min > 0) {
        salaryMin = job.salary_min;
        salaryCurrency = 'IDR';
      }
      if (typeof job.salary_max === 'number' && job.salary_max > 0) {
        salaryMax = job.salary_max;
        salaryCurrency = 'IDR';
      }
      if (!salaryMin && job.ld_json?.baseSalary?.value?.minValue) {
        salaryMin = job.ld_json.baseSalary.value.minValue;
        salaryMax = job.ld_json.baseSalary.value.maxValue;
        salaryCurrency = job.ld_json.baseSalary.currency || 'IDR';
      }
    }

    const workMode = normalizeLokerIdWorkMode(job.is_remote, job.job_location_type);
    const employmentType =
      normalizeLokerIdEmploymentType(job.job_type) ??
      normalizeLokerIdEmploymentType(job.types?.[0]?.name) ??
      normalizeLokerIdEmploymentType(job.ld_json?.employmentType);

    const skills = (job.job_skills ?? [])
      .map((s) => s.name?.trim())
      .filter((s): s is string => !!s && s.length > 0);

    return {
      description,
      ...(qualText ? { requirements: qualText } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(salaryMin !== undefined ? { salaryMin } : {}),
      ...(salaryMax !== undefined ? { salaryMax } : {}),
      ...(salaryCurrency ? { salaryCurrency } : {}),
      workMode,
      ...(employmentType ? { employmentType } : {}),
    };
  }

  // Fallback: Schema.org JobPosting from HTML
  const schemaRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let schemaMatch: RegExpExecArray | null;
  while ((schemaMatch = schemaRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(schemaMatch[1] ?? '{}');
      if (parsed?.['@type'] === 'JobPosting') {
        const description = cleanHtmlToText(parsed.description ?? '');
        const employmentType = normalizeLokerIdEmploymentType(parsed.employmentType);
        return {
          description,
          ...(employmentType ? { employmentType } : {}),
        };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}
