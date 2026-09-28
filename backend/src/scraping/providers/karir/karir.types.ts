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
