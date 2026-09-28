export interface KalibrrJobDoc {
  id?: number | string;
  name?: string;
  title?: string;
  company_name?: string;
  city?: string;
  country?: string;
  work_arrangement?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  created_at?: string;
  job_slug?: string;
  company_slug?: string;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  skills?: string[];
  [key: string]: unknown;
}

export interface KalibrrNextData {
  props?: {
    pageProps?: {
      jobs?: KalibrrJobDoc[];
      job?: KalibrrJobDoc;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
