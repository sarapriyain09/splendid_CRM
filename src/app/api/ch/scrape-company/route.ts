import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

type HiringSignal = 'design_engineer' | 'mechanical_engineer' | 'new_product_post' | 'team_active' | 'none';
type GrowthSignal = 'new_factory' | 'new_product' | 'contract_win' | 'expansion' | 'none';

const SKIP_EMAIL = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|ttf)|@example|@sentry|@schema|noreply|no-reply|wordpress|woocommerce/i;
const BOT_UA = 'Mozilla/5.0 (compatible; SplendidCRMBot/1.0; +https://splendidtechnology.co.uk)';

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': BOT_UA },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    clearTimeout(timer);
    return '';
  }
}

function toPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#\d]+;/gi, ' ').replace(/\s+/g, ' ');
}

function extractEmployeeCount(text: string): number | null {
  const patterns = [
    /(?:over|around|approximately|circa|~)?\s*(\d[\d,]*)\s*\+?\s*(?:full[- ]time\s+)?(?:employees?|members of staff|staff members?|team members?|people|engineers?|professionals?)/gi,
    /(?:team|workforce|crew)\s+of\s+(?:over\s+)?(\d[\d,]*)/gi,
    /employ(?:s|ing)\s+(?:over\s+)?(\d[\d,]*)/gi,
    /(\d[\d,]*)[- ]strong\b/gi,
    /(?:company size|size)[:\s]+(\d[\d,]*)[-–](\d[\d,]*)/gi,
  ];
  const candidates: number[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (m[2]) {
        const lo = parseInt(m[1].replace(/,/g, ''), 10);
        const hi = parseInt(m[2].replace(/,/g, ''), 10);
        if (!isNaN(lo) && !isNaN(hi)) candidates.push(Math.round((lo + hi) / 2));
      } else {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        if (!isNaN(n) && n >= 5 && n <= 50000) candidates.push(n);
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a - b);
  return candidates[Math.floor(candidates.length / 2)];
}

function detectHiring(text: string): HiringSignal {
  const t = text.toLowerCase();
  if (/\b(?:design engineer|cad engineer|solidworks engineer|design draughtsman|cad technician|3d modell)\b/.test(t)) return 'design_engineer';
  if (/\b(?:mechanical engineer|structural engineer|manufacturing engineer|process engineer|production engineer)\b/.test(t)) return 'mechanical_engineer';
  if (/\b(?:new product|product launch|r&d|research and development|product development)\b/.test(t)) return 'new_product_post';
  if (/\b(?:engineering team|design team|technical team|our engineers|our designers)\b/.test(t)) return 'team_active';
  return 'none';
}

function detectGrowth(text: string): GrowthSignal {
  const t = text.toLowerCase();
  if (/\b(?:new factory|new facility|new site|new premises|new warehouse|new plant|new headquarters|new hq)\b/.test(t)) return 'new_factory';
  if (/\b(?:new product|product launch|launched|new range|new model|new system)\b/.test(t)) return 'new_product';
  if (/\b(?:contract award|contract win|won contract|secured contract|new contract|awarded contract)\b/.test(t)) return 'contract_win';
  if (/\b(?:expansion|expanded|growing|new investment|capital investment|recruited|growing team|increased capacity)\b/.test(t)) return 'expansion';
  return 'none';
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let baseUrl: string;
  try {
    const u = new URL(url);
    baseUrl = `${u.protocol}//${u.host}`;
  } catch {
    return NextResponse.json({ emails: [], employeeCount: null, hiringSignal: 'none', growthSignal: 'none' });
  }

  // Fetch main page + secondary pages in parallel
  const subpages = ['', '/about', '/about-us', '/our-story', '/careers', '/jobs', '/vacancies', '/news', '/press', '/latest-news'];
  const fetched = await Promise.allSettled(subpages.map(p => fetchPage(baseUrl + p)));

  const htmlPages = fetched.map(r => r.status === 'fulfilled' ? r.value : '');
  const mainHtml = htmlPages[0];
  const allText = htmlPages.map(toPlain).join(' ');

  // Emails — from main page only to avoid noise
  const rawEmails = mainHtml.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  const emails = [...new Set(rawEmails.filter(e => !SKIP_EMAIL.test(e)))].slice(0, 5);

  const employeeCount = extractEmployeeCount(allText);
  const hiringSignal: HiringSignal = detectHiring(allText);
  const growthSignal: GrowthSignal = detectGrowth(allText);

  return NextResponse.json({ emails, employeeCount, hiringSignal, growthSignal });
}
