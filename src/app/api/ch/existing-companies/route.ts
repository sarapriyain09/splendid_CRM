import { type NextRequest, NextResponse } from 'next/server';
import { searchExistingCompanies } from '@/lib/companies-house';
import { scoreLead, getTier } from '@/lib/lead-scorer';
import { ALL_TRACKED_SIC_CODES } from '@/lib/sic-codes';
import type { Lead } from '@/lib/types-ch';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rawSic = searchParams.get('sic_codes');
  const sicCodes = rawSic ? rawSic.split(',').map((s) => s.trim()) : ALL_TRACKED_SIC_CODES;
  const rawLoc = searchParams.get('locations');
  const locations = rawLoc ? rawLoc.split(',').map((s) => s.trim()).filter(Boolean) : ['Leicester', 'Birmingham'];
  const startIndex = Number(searchParams.get('start_index') ?? '0');

  try {
    const result = await searchExistingCompanies({ sicCodes, locations, size: 100, startIndex, companyStatus: 'active' });
    const leads: Lead[] = (result.items ?? []).map((company) => {
      const breakdown = scoreLead(company, 'unknown');
      return { company, websiteStatus: 'unknown', leadScore: breakdown.total, leadTier: getTier(breakdown.total), scoreBreakdown: breakdown };
    });
    leads.sort((a, b) => b.leadScore - a.leadScore);
    return NextResponse.json({ hits: result.hits, leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
