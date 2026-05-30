// Email guesser — no external type imports needed

const COMMON_PREFIXES = [
  'info',
  'hello',
  'contact',
  'enquiries',
  'admin',
  'office',
  'sales',
];

export interface GuessedEmail {
  address: string;
  confidence: 'high' | 'medium' | 'low';
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function guessEmailsFromUrl(websiteUrl: string): GuessedEmail[] {
  const domain = extractDomain(websiteUrl);
  if (!domain) return [];

  return COMMON_PREFIXES.map((prefix, i) => ({
    address: `${prefix}@${domain}`,
    confidence: i === 0 ? 'high' : i <= 2 ? 'medium' : 'low',
  }));
}

export function guessEmailsFromCompanyName(companyName: string): GuessedEmail[] {
  const cleaned = companyName
    .toLowerCase()
    .replace(/\b(limited|ltd|llp|plc|lp|cic|co\.?|group|holdings?|services?|solutions?|consultants?|associates?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '');

  if (!cleaned || cleaned.length < 2) return [];

  const domains = [`${cleaned}.co.uk`, `${cleaned}.com`];

  return ['info', 'contact', 'hello'].flatMap((prefix, i) =>
    domains.map((domain) => ({
      address: `${prefix}@${domain}`,
      confidence: (i === 0 ? 'medium' : 'low') as 'medium' | 'low',
    })),
  );
}
