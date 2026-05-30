import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

const CH_API_BASE = 'https://api.company-information.service.gov.uk';

function getAuthHeader(): string {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get('company_number');
  if (!companyNumber) return NextResponse.json({ error: 'company_number required' }, { status: 400 });

  try {
    const res = await fetch(`${CH_API_BASE}/company/${companyNumber}/officers?items_per_page=10`, {
      headers: { Authorization: getAuthHeader(), Accept: 'application/json' },
    });
    if (!res.ok) return NextResponse.json({ error: `CH API ${res.status}` }, { status: res.status });
    const data = await res.json();
    const active = (data.items ?? []).filter((o: { resigned_on?: string }) => !o.resigned_on);
    return NextResponse.json({ items: active, total_results: data.total_results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
