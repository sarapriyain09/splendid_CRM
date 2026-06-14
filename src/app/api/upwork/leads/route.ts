import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

const STATUS_ORDER = ['upwork_prospect', 'proposal_sent', 'interview', 'opportunity', 'won', 'lost'];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getDb();
  const leads = db.prepare(`
    SELECT id, company_name, source, stage, lead_score, vertical, updated_at,
           upwork_client_name, upwork_company, upwork_project_title, upwork_project_url,
           upwork_budget, upwork_proposal_date, upwork_proposal_status
    FROM leads
    WHERE source = 'upwork'
    ORDER BY datetime(updated_at) DESC
    LIMIT 300
  `).all() as Array<Record<string, any>>;

  const countsRaw = db.prepare(`
    SELECT COALESCE(upwork_proposal_status, 'proposal_sent') as status, COUNT(*) as c
    FROM leads
    WHERE source = 'upwork'
    GROUP BY COALESCE(upwork_proposal_status, 'proposal_sent')
  `).all() as Array<{ status: string; c: number }>;

  const countMap = Object.fromEntries(countsRaw.map(r => [r.status, r.c]));
  const statusCounts = STATUS_ORDER.map(status => ({ status, count: Number(countMap[status] ?? 0) }));

  const total = statusCounts.reduce((a, b) => a + b.count, 0);
  const proposalSent = Number(countMap.proposal_sent ?? 0);
  const interviews = Number(countMap.interview ?? 0);
  const opportunities = Number(countMap.opportunity ?? 0);
  const won = Number(countMap.won ?? 0);

  return NextResponse.json({
    ok: true,
    leads,
    summary: {
      total,
      proposalSent,
      interviews,
      opportunities,
      won,
      proposalToInterviewRate: proposalSent > 0 ? Math.round((interviews / proposalSent) * 100) : 0,
      interviewToWonRate: interviews > 0 ? Math.round((won / interviews) * 100) : 0,
    },
    statusCounts,
  });
}
