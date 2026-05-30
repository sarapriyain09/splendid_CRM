import { type NextRequest, NextResponse } from 'next/server';
import { checkWebsite } from '@/lib/website-checker';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get('company_name');
  if (!companyName?.trim()) return NextResponse.json({ error: 'company_name required' }, { status: 400 });

  try {
    const result = await checkWebsite(companyName.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
