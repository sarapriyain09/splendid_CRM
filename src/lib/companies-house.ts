import type { CHCompany as CompanySearchResult } from './types-ch';

const CH_API_BASE = 'https://api.company-information.service.gov.uk';

function getAuthHeader(): string {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    throw new Error('COMPANIES_HOUSE_API_KEY environment variable is not set.');
  }
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

export interface SearchOptions {
  sicCodes: string[];
  incorporatedFrom: string; // YYYY-MM-DD
  incorporatedTo: string;   // YYYY-MM-DD
  size?: number;
  startIndex?: number;
}

export interface ExistingSearchOptions {
  sicCodes: string[];
  locations: string[];      // e.g. ['Leicester', 'Birmingham']
  size?: number;
  startIndex?: number;
  companyStatus?: string;   // default 'active'
}

export interface SearchResponse {
  hits: number;
  items: CompanySearchResult[];
}

export async function searchNewCompanies(
  options: SearchOptions,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    incorporated_from: options.incorporatedFrom,
    incorporated_to: options.incorporatedTo,
    size: String(options.size ?? 100),
    start_index: String(options.startIndex ?? 0),
  });

  for (const code of options.sicCodes) {
    params.append('sic_codes', code);
  }

  const url = `${CH_API_BASE}/advanced-search/companies?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Companies House API error ${response.status}: ${body || response.statusText}`,
    );
  }

  return response.json() as Promise<SearchResponse>;
}

export async function searchExistingCompanies(
  options: ExistingSearchOptions,
): Promise<SearchResponse> {
  // CH advanced search does not support OR for location, so we fetch per location and merge
  const perLocation = Math.ceil((options.size ?? 100) / options.locations.length);

  const fetches = options.locations.map(async (loc) => {
    const params = new URLSearchParams({
      location: loc,
      company_status: options.companyStatus ?? 'active',
      size: String(perLocation),
      start_index: String(options.startIndex ?? 0),
    });
    for (const code of options.sicCodes) params.append('sic_codes', code);

    const url = `${CH_API_BASE}/advanced-search/companies?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader(), Accept: 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Companies House API error ${response.status}: ${body || response.statusText}`);
    }

    return response.json() as Promise<SearchResponse>;
  });

  const results = await Promise.all(fetches);

  // Merge and deduplicate by company_number
  const seen = new Set<string>();
  const items: CompanySearchResult[] = [];
  let totalHits = 0;

  for (const r of results) {
    totalHits += r.hits ?? 0;
    for (const item of r.items ?? []) {
      if (!seen.has(item.company_number)) {
        seen.add(item.company_number);
        items.push(item);
      }
    }
  }

  return { hits: totalHits, items };
}

export function buildCompaniesHouseProfileUrl(companyNumber: string): string {
  return `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;
}

export interface OfficersResponse {
  active_count: number;
  inactive_count: number;
  items: Array<{
    name: string;
    officer_role: string;
    appointed_on: string | null;
    resigned_on: string | null;
    nationality: string | null;
    occupation: string | null;
    address: Record<string, string | undefined>;
  }>;
  items_per_page: number;
  kind: string;
  links: Record<string, string>;
  resigned_count: number;
  start_index: number;
  total_results: number;
}

export async function fetchOfficers(companyNumber: string): Promise<OfficersResponse> {
  const url = `${CH_API_BASE}/company/${companyNumber}/officers?items_per_page=10`;

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Companies House officers API error ${response.status}: ${body || response.statusText}`,
    );
  }

  return response.json() as Promise<OfficersResponse>;
}
