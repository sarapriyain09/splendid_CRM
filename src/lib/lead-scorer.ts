import type { CHCompany as CompanySearchResult, LeadTier, ScoreBreakdown, WebsiteStatus } from './types-ch';
import { getBestSicTier } from './sic-codes';

const SIC_TIER_SCORES: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 40,
  2: 20,
  3: 5,
};

const WEBSITE_SCORES: Record<Exclude<WebsiteStatus, 'checking'>, number> = {
  not_found: 50,
  construction: 25,
  unknown: 15,
  found: 0,
};

export function scoreLead(
  company: CompanySearchResult,
  websiteStatus: Exclude<WebsiteStatus, 'checking'>,
): ScoreBreakdown {
  const sicCodes = company.sic_codes ?? [];
  const sicTier = getBestSicTier(sicCodes);
  const sicScore = SIC_TIER_SCORES[sicTier];

  const incDate = new Date(company.date_of_creation);
  const ageMs = Date.now() - incDate.getTime();
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);
  let newCompanyScore = 0;
  if (ageMonths <= 3) newCompanyScore = 30;
  else if (ageMonths <= 6) newCompanyScore = 20;
  else if (ageMonths <= 12) newCompanyScore = 10;

  const websiteScore = WEBSITE_SCORES[websiteStatus];
  const total = sicScore + newCompanyScore + websiteScore;

  return { sicScore, newCompanyScore, websiteScore, total };
}

export function getTier(score: number): LeadTier {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 30) return 'cool';
  return 'cold';
}

export function formatLocation(company: CompanySearchResult): string {
  const addr = company.registered_office_address;
  const parts = [addr.locality, addr.postal_code?.split(' ')[0]].filter(Boolean);
  return parts.join(', ') || 'Unknown';
}
