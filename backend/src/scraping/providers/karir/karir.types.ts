export interface KarirOpportunityDoc {
  id?: number | string;
  title?: string;
  name?: string;
  slug?: string;
  company?: {
    id?: number | string;
    name?: string;
    slug?: string;
  };
  location?: {
    name?: string;
    city?: string;
  };
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  created_at?: string;
  posted_at?: string;
  description?: string;
  requirements?: string[];
  skills?: string[];
  [key: string]: unknown;
}

export interface KarirNextData {
  props?: {
    pageProps?: {
      opportunities?: KarirOpportunityDoc[];
      opportunity?: KarirOpportunityDoc;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KarirApiOpportunity {
  id: number | string;
  job_position?: string;
  title?: string;
  name?: string;
  slug?: string;
  company_name?: string;
  company_id?: number | string;
  description?: string;
  location?: {
    name?: string;
    city?: string;
  };
  salary_lower?: number | null;
  salary_upper?: number | null;
  salary_info?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  posted_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface KarirApiDetailData {
  id: number | string;
  job_position?: string;
  requirements?: string | null;
  responsibilities?: string | null;
  required_skills?: Array<{ name?: string; skill_name?: string } | string> | null;
  location?: string | null;
  opportunities_link?: string | null;
  company_name?: string | null;
  salary_lower?: number | null;
  salary_upper?: number | null;
  [key: string]: unknown;
}

export interface KarirSearchApiResponse {
  code: number;
  message?: string | null;
  data?: {
    total_opportunities?: number;
    opportunities?: KarirApiOpportunity[] | null;
  };
}

export interface KarirDetailApiResponse {
  code: number;
  message?: string | null;
  data?: KarirApiDetailData | null;
}

