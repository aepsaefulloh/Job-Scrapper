export interface KitaLulusVacancy {
  id?: string;
  slug?: string;
  title?: string;
  company_name?: string;
  city?: string;
  province?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  work_arrangement?: string;
  employment_type?: string;
  description?: string;
  requirements?: string[];
  skills?: string[];
  created_at?: string;
  updated_at?: string;
  expired_at?: string;
  [key: string]: unknown;
}

export interface KitaLulusNextData {
  props?: {
    pageProps?: {
      initialState?: {
        vacancies?: KitaLulusVacancy[];
        [key: string]: unknown;
      };
      vacancy?: KitaLulusVacancy;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
