export interface DeallsSalaryRange {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  display?: string | null;
}

export interface DeallsCompany {
  id?: string;
  name?: string;
  slug?: string;
  logoUrl?: string;
}

export interface DeallsSkill {
  id?: string;
  name: string;
}

export interface DeallsJobDoc {
  id: string;
  slug: string;
  role: string;
  authorId?: string;
  employmentTypes?: string[];
  workplaceType?: string;
  publishedAt?: string;
  status?: string;
  salaryType?: string;
  salaryRange?: DeallsSalaryRange | null;
  company?: DeallsCompany;
  city?: {
    id?: number;
    name?: string;
  };
  country?: {
    id?: number;
    name?: string;
  };
  skills?: DeallsSkill[];
  externalPlatformApplyUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeallsPageData {
  docs?: DeallsJobDoc[];
  totalDocs?: number;
  totalPages?: number;
  page?: number;
}

export interface DeallsQueryState {
  queryKey?: unknown[];
  state?: {
    data?: {
      pages?: DeallsPageData[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface DeallsNextData<TQuery = DeallsQueryState> {
  props?: {
    pageProps?: {
      dehydratedState?: {
        queries?: TQuery[];
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface DeallsDetailJobData {
  id: string;
  slug: string;
  role: string;
  description?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  perks?: string[] | null;
  customPerks?: string[] | null;
  workplaceType?: string;
  employmentTypes?: string[];
  salaryRange?: DeallsSalaryRange | null;
  company?: DeallsCompany;
  city?: {
    id?: number;
    name?: string;
  };
  publishedAt?: string;
}

export interface DeallsDetailQueryState {
  queryKey?: unknown[];
  state?: {
    data?: DeallsDetailJobData;
    [key: string]: unknown;
  };
}
