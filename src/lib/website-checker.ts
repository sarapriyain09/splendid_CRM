import type { WebsiteCheckResponse } from './types-ch';

const CONSTRUCTION_PHRASES = [
  'coming soon',
  'under construction',
  'launching soon',
  'site maintenance',
  'under maintenance',
  "we're working on it",
  'website coming soon',
  'almost ready',
  'stay tuned',
  'website under development',
  'page not ready',
];

/**
 * Derive candidate website URLs from a UK company name.
 * Removes legal suffixes, strips punctuation, and tries common TLDs.
 */
function deriveWebsiteUrls(companyName: string): string[] {
  const cleaned = companyName
    .toLowerCase()
    .replace(/\b(limited|ltd|llp|plc|lp|cic|co\.?|group|holdings?|services?|solutions?|consultants?|associates?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!cleaned) return [];

  const noHyphens = cleaned.replace(/-/g, '');

  const candidates: string[] = [
    `https://www.${cleaned}.co.uk`,
    `https://www.${cleaned}.com`,
    `https://${cleaned}.co.uk`,
    `https://${cleaned}.com`,
  ];

  if (noHyphens !== cleaned && noHyphens.length > 2) {
    candidates.push(`https://www.${noHyphens}.co.uk`);
    candidates.push(`https://www.${noHyphens}.com`);
  }

  return candidates;
}

async function tryUrl(url: string): Promise<{ ok: boolean; html?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SplendidLeadsBot/1.0; +https://splendidtechnology.co.uk)',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!res.ok && res.status !== 200) return { ok: false };

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      const html = await res.text().catch(() => '');
      return { ok: true, html };
    }

    return { ok: true };
  } catch {
    clearTimeout(timer);
    return { ok: false };
  }
}

function isConstructionPage(html: string): boolean {
  const lower = html.toLowerCase();
  return CONSTRUCTION_PHRASES.some((phrase) => lower.includes(phrase));
}

export async function checkWebsite(
  companyName: string,
  knownUrl?: string,
): Promise<WebsiteCheckResponse> {
  const urlsToTry = knownUrl
    ? [knownUrl, ...deriveWebsiteUrls(companyName)]
    : deriveWebsiteUrls(companyName);

  for (const url of urlsToTry) {
    const result = await tryUrl(url);
    if (result.ok) {
      if (result.html && isConstructionPage(result.html)) {
        return { status: 'construction', url };
      }
      return { status: 'found', url };
    }
  }

  return { status: 'not_found' };
}
