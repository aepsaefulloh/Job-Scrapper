export interface GlintsSkillDetail {
  id?: string;
  name?: string;
}

export interface GlintsSkill {
  skill?: GlintsSkillDetail;
  name?: string;
  mustHave?: boolean;
}

export interface GlintsSalary {
  id?: string;
  salaryType?: string;
  salaryMode?: string;
  minAmount?: number;
  maxAmount?: number;
  CurrencyCode?: string;
  currencyCode?: string;
}

export interface GlintsLocationItem {
  id?: string;
  name?: string;
  formattedName?: string;
}

export interface GlintsCompany {
  id?: string;
  name?: string;
  logo?: string;
}

export interface GlintsJobInPage {
  id: string;
  title: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  isRemote?: boolean;
  workArrangementOption?: string; // 'ONSITE' | 'REMOTE' | 'HYBRID' | 'WFO'
  type?: string; // 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP'
  salaries?: GlintsSalary[] | null;
  shouldShowSalary?: boolean;
  company?: GlintsCompany | string | null;
  city?: GlintsLocationItem | null;
  country?: GlintsLocationItem | string | null;
  location?: GlintsLocationItem | null;
  formattedLocation?: string;
  skills?: GlintsSkill[] | null;
  educationLevel?: string;
  isHot?: boolean;
}

export interface GlintsSearchPageProps {
  props?: {
    pageProps?: {
      initialJobs?: {
        jobsInPage?: GlintsJobInPage[];
      };
    };
  };
}

export interface GlintsDraftJsBlock {
  key?: string;
  text?: string;
  type?: string;
  depth?: number;
}

export interface GlintsDraftJsData {
  blocks?: GlintsDraftJsBlock[];
}

export interface GlintsDetailPageProps {
  props?: {
    pageProps?: {
      initialData?: {
        data?: {
          id?: string;
          title?: string;
          descriptionJsonString?: string;
          company?: GlintsCompany | string | null;
          status?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
    };
  };
}
