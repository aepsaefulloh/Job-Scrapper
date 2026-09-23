export interface LokerIdJobLocationType {
  id?: number;
  name?: string;
  slug?: string;
}

export interface LokerIdSkillItem {
  id?: number;
  name: string;
  slug?: string;
}

export interface LokerIdJobItem {
  id: number | string;
  slug: string;
  title: string;
  company_name?: string | null;
  company_slug?: string | null;
  company_logo?: string | null;
  location?: string | null;
  job_type?: string | null;
  types?: Array<{ id?: number; name: string; slug?: string }> | null;
  is_remote?: boolean;
  job_location_type?: LokerIdJobLocationType | null;
  salary_min?: number | null;
  salary_max?: number | null;
  job_salary?: string | null;
  is_hide_salary?: boolean;
  published_at?: string | null;
  post_date?: string | null;
  closed_at?: string | null;
  job_skills?: LokerIdSkillItem[] | null;
  job_benefits?: string | null;
  job_experience?: string | null;
  categories?: Array<{ id?: number; name: string; slug?: string; parent?: { name?: string; slug?: string } }> | null;
  locations?: Array<{ id?: number; name: string; slug?: string; parent?: { name?: string; slug?: string } }> | null;
}

export interface LokerIdPaginationMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface LokerIdSearchRouteData {
  jobs?: LokerIdJobItem[];
  meta?: LokerIdPaginationMeta;
  detailJob?: unknown;
  jobid?: string | number;
}

export interface LokerIdDetailJob extends LokerIdJobItem {
  job_description?: string | null;
  content?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  incentive_compensation?: string | null;
  ld_json?: {
    '@context'?: string;
    '@type'?: string;
    title?: string;
    description?: string;
    datePosted?: string;
    employmentType?: string;
    jobLocation?: {
      address?: {
        addressLocality?: string;
        addressRegion?: string;
        addressCountry?: string;
      };
    };
    baseSalary?: {
      currency?: string;
      value?: {
        minValue?: number;
        maxValue?: number;
        unitText?: string;
      };
    };
    hiringOrganization?: {
      name?: string;
      logo?: string;
    };
  } | null;
}

export interface LokerIdDetailRouteData {
  jobId?: number | string;
  job?: LokerIdDetailJob;
  jobslug?: string;
  company?: unknown;
}

export interface LokerIdRemixContext {
  state?: {
    loaderData?: Record<string, unknown>;
  };
}
