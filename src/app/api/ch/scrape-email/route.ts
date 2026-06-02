import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Scrapes a website's HTML and extracts real email addresses found in the page
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SplendidCRMBot/1.0; +https://splendidtechnology.co.uk)',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) return NextResponse.json({ emails: [] });

    const html = await res.text();

    // Extract emails from HTML — skip images, icons, common placeholder patterns
    const raw = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
    const SKIP = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|ttf)|@example|@sentry|@schema|noreply|no-reply|wordpress|woocommerce/i;
    const emails = [...new Set(raw.filter(e => !SKIP.test(e)))].slice(0, 5);

    return NextResponse.json({ emails });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ emails: [] });
  }
}
