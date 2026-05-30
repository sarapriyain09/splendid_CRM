import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const db = getDb();

  const totalLeads   = (db.prepare("SELECT COUNT(*) as c FROM leads").get() as { c: number }).c;
  const hotLeads     = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE lead_score >= 70").get() as { c: number }).c;
  const wonDeals     = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE stage = 'won'").get() as { c: number }).c;
  const openQuotes   = (db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status IN ('draft','sent')").get() as { c: number }).c;
  const quoteValue   = (db.prepare("SELECT COALESCE(SUM(total),0) as v FROM quotes WHERE status IN ('draft','sent','accepted')").get() as { v: number }).v;
  const recentLeads  = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5").all();
  const stageCount   = db.prepare("SELECT stage, COUNT(*) as c FROM leads GROUP BY stage").all() as { stage: string; c: number }[];

  return NextResponse.json({ totalLeads, hotLeads, wonDeals, openQuotes, quoteValue, recentLeads, stageCount });
}
