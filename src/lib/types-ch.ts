// Types specific to Companies House / lead generator feature
// (separate from CRM's main types.ts)

export interface CHAddress {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  postal_code?: string;
  country?: string;
  region?: string;
}

export interface CHCompany {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address: CHAddress;
  sic_codes: string[];
  links?: { company_profile?: string };
}

export type WebsiteStatus = 'found' | 'not_found' | 'construction' | 'checking' | 'unknown';
export type LeadTier = 'hot' | 'warm' | 'cool' | 'cold';

export interface ScoreBreakdown {
  sicScore: number;
  newCompanyScore: number;
  websiteScore: number;
  total: number;
}

export interface Lead {
  company: CHCompany;
  websiteStatus: WebsiteStatus;
  websiteUrl?: string;
  leadScore: number;
  leadTier: LeadTier;
  scoreBreakdown: ScoreBreakdown;
}

export interface Officer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
}

export interface WebsiteCheckResponse {
  status: Exclude<WebsiteStatus, 'checking'>;
  url?: string;
}
