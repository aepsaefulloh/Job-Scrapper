export type JobSearchQuery = { keyword?: string; location?: string; remote?: boolean; page?: number; maxPages?: number; maxPostingAgeDays?: number; detailLimit?: number };
export type ScrapedJob = { source: string; externalId?: string; title: string; company?: string; location?: string; workMode?: 'remote' | 'hybrid' | 'onsite' | 'unknown'; employmentType?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string; description?: string; skills?: string[]; jobUrl: string; publishedAt?: string; scrapedAt: string; metadata?: Record<string, unknown> };
export interface JobScraper { source: string; search(query: JobSearchQuery): Promise<ScrapedJob[]>; }
export type ScrapePipelineStage = 'browser' | 'search' | 'detail' | 'ingestion' | 'embedding' | 'scrape_run';
