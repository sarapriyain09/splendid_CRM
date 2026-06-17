import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import { ensureWeeklyPlaybookTasks } from '@/lib/campaign-playbook';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const db = getDb();

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const shouldAutoCreate = day === 1 && hour >= 6;

  let playbookAutoCreated = 0;
  if (shouldAutoCreate) {
    const userId = Number((session.user as { id?: string | number } | undefined)?.id ?? 0) || null;
    const autoResult = ensureWeeklyPlaybookTasks(db, { userId, now, force: false });
    playbookAutoCreated = autoResult.created;
  }

  const totalLeads   = (db.prepare("SELECT COUNT(*) as c FROM leads").get() as { c: number }).c;
  const hotLeads     = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE lead_score >= 70").get() as { c: number }).c;
  const wonDeals     = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE stage = 'won'").get() as { c: number }).c;
  const openQuotes   = (db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status IN ('draft','sent')").get() as { c: number }).c;
  const quoteValue   = (db.prepare("SELECT COALESCE(SUM(total),0) as v FROM quotes WHERE status IN ('draft','sent','accepted')").get() as { v: number }).v;
  const recentLeads  = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5").all();
  const stageCount   = db.prepare("SELECT stage, COUNT(*) as c FROM leads GROUP BY stage").all() as { stage: string; c: number }[];

  const campaignTasksToday = (db.prepare(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND date(due_date) = date('now')
  `).get() as { c: number }).c;

  const campaignTasksWeek = (db.prepare(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND date(due_date) BETWEEN date('now', 'weekday 1', '-7 days') AND date('now', 'weekday 0')
  `).get() as { c: number }).c;

  const campaignTasksOpen = (db.prepare(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND done = 0
  `).get() as { c: number }).c;

  return NextResponse.json({
    totalLeads,
    hotLeads,
    wonDeals,
    openQuotes,
    quoteValue,
    recentLeads,
    stageCount,
    campaignKpi: {
      tasksToday: campaignTasksToday,
      tasksWeek: campaignTasksWeek,
      tasksOpen: campaignTasksOpen,
      autoCreatedThisRequest: playbookAutoCreated,
    },
  });
}
