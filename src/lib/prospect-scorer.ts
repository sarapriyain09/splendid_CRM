export interface WebsiteAnalysis {
  url: string | null;
  status: 'no_website' | 'unreachable' | 'analysed';
  hasSsl: boolean;
  isMobileFriendly: boolean;
  hasContactForm: boolean;
  loadTimeMs: number | null;
  isSlowLoading: boolean;
  hasSeoIssues: boolean;      // Missing meta description or H1
  hasCrmKeywords: boolean;    // CRM platform keywords found on site
  hasProductionKeywords: boolean; // Manufacturing/production keywords found
  opportunityScore: number;   // 0–100. Higher = bigger opportunity for us.
  opportunityLabel: 'hot' | 'warm' | 'low';
  reasons: string[];          // Human-readable reasons e.g. "No SSL certificate"
}

// Scoring thresholds (from the spec)
const SLOW_THRESHOLD_MS = 3000;

// Score contributions when a check FAILS (i.e. opportunity exists)
const SCORE_NO_SSL       = 20;
const SCORE_NOT_MOBILE   = 30;
const SCORE_NO_CONTACT   = 10;
const SCORE_SLOW         = 20;

function opportunityLabel(score: number): 'hot' | 'warm' | 'low' {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  return 'low';
}

export async function analyseWebsite(url?: string | null): Promise<WebsiteAnalysis> {
  // ── No website ─────────────────────────────────────────────────────────
  if (!url) {
    return {
      url: null,
      status: 'no_website',
      hasSsl: false,
      isMobileFriendly: false,
      hasContactForm: false,
      loadTimeMs: null,
      isSlowLoading: false,
      hasCrmKeywords: false,
      hasProductionKeywords: false,
      opportunityScore: 100,
      opportunityLabel: 'hot',
      hasSeoIssues: false,
      reasons: ['No website'],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SplendidProspectBot/1.0; +https://splendidtechnology.co.uk)',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    const loadTimeMs = Date.now() - start;

    if (!res.ok) {
      return {
        url,
        status: 'unreachable',
        hasSsl: false,
        isMobileFriendly: false,
        hasContactForm: false,
        loadTimeMs,
        isSlowLoading: false,
        hasCrmKeywords: false,
        hasProductionKeywords: false,
        opportunityScore: 90,
        opportunityLabel: 'hot',
        hasSeoIssues: false,
        reasons: ['Website is broken or unreachable'],
      };
    }

    const hasSsl = res.url.startsWith('https://');
    const html   = (await res.text().catch(() => '')).toLowerCase();

    const isMobileFriendly = html.includes('name="viewport"') || html.includes("name='viewport'");
    const hasContactForm   =
      html.includes('<form') ||
      (html.includes('contact') && (html.includes('href') || html.includes('<a')));
    const isSlowLoading = loadTimeMs > SLOW_THRESHOLD_MS;

    const CRM_KEYWORDS = ['salesforce', 'hubspot', 'zoho', 'pipedrive', 'crm', 'dynamics 365', 'monday.com', 'freshsales'];
    const PROD_KEYWORDS = ['manufacturing', 'machining', 'fabrication', 'production line', 'precision engineering', 'cnc', 'tooling', 'industrial', 'automation', 'warehousing', 'logistics'];
    const hasCrmKeywords        = CRM_KEYWORDS.some(k => html.includes(k));
    const hasProductionKeywords = PROD_KEYWORDS.some(k => html.includes(k));

    const hasMetaDesc = html.includes('name="meta-description"') || html.includes('name="description"') || html.includes("name='description'");
    const hasH1       = html.includes('<h1');
    const hasSeoIssues = !hasMetaDesc || !hasH1;

    let score = 0;
    const reasons: string[] = [];

    if (!hasSsl)         { score += SCORE_NO_SSL;     reasons.push('No SSL certificate'); }
    if (!isMobileFriendly){ score += SCORE_NOT_MOBILE; reasons.push('Not mobile friendly'); }
    if (!hasContactForm)  { score += SCORE_NO_CONTACT; reasons.push('No contact form'); }
    if (isSlowLoading)    { score += SCORE_SLOW;       reasons.push(`Slow loading (${(loadTimeMs / 1000).toFixed(1)}s)`); }
    if (hasSeoIssues)     { score += 15;               reasons.push('Poor SEO setup'); }

    if (reasons.length === 0) reasons.push('Website looks good');

    return {
      url: res.url,
      status: 'analysed',
      hasSsl,
      isMobileFriendly,
      hasContactForm,
      loadTimeMs,
      isSlowLoading,
      hasSeoIssues,
      hasCrmKeywords,
      hasProductionKeywords,
      opportunityScore: score,
      opportunityLabel: opportunityLabel(score),
      reasons,
    };
  } catch {
    clearTimeout(timer);
    return {
      url,
      status: 'unreachable',
      hasSsl: false,
      isMobileFriendly: false,
      hasContactForm: false,
      loadTimeMs: Date.now() - start,
      isSlowLoading: false,
      hasSeoIssues: false,
      hasCrmKeywords: false,
      hasProductionKeywords: false,
      opportunityScore: 90,
      opportunityLabel: 'hot',
      reasons: ['Website unreachable or timed out'],
    };
  }
}
