import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { guessEmailsFromUrl, guessEmailsFromCompanyName } from '@/lib/email-guesser';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const websiteUrl  = searchParams.get('website_url') ?? '';
  const companyName = searchParams.get('company_name') ?? '';

  const emails = websiteUrl
    ? guessEmailsFromUrl(websiteUrl)
    : guessEmailsFromCompanyName(companyName);

  return NextResponse.json({ emails });
}
