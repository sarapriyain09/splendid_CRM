import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { queryAll, queryOne } from '@/lib/db-client';
import { ensureWeeklyPlaybookTasks } from '@/lib/campaign-playbook';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const shouldAutoCreate = day === 1 && hour >= 6;

  let playbookAutoCreated = 0;
  if (shouldAutoCreate) {
    const userId = Number((session.user as { id?: string | number } | undefined)?.id ?? 0) || null;
    const autoResult = await ensureWeeklyPlaybookTasks({ userId, now, force: false });
    playbookAutoCreated = autoResult.created;
  }

  const totalLeads   = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM leads"))!.c;
  const hotLeads     = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM leads WHERE lead_score >= 70"))!.c;
  const wonDeals     = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM leads WHERE stage = 'won'"))!.c;
  const openQuotes   = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM quotes WHERE status IN ('draft','sent')"))!.c;
  const quoteValue   = (await queryOne<{ v: number }>("SELECT COALESCE(SUM(total),0) as v FROM quotes WHERE status IN ('draft','sent','accepted')"))!.v;
  const recentLeads  = await queryAll("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5");
  const stageCount   = await queryAll<{ stage: string; c: number }>("SELECT stage, COUNT(*) as c FROM leads GROUP BY stage");

  const campaignTasksToday = (await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND date(due_date) = date('now')
  `))!.c;

  const campaignTasksWeek = (await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND date(due_date) BETWEEN date('now', 'weekday 1', '-7 days') AND date('now', 'weekday 0')
  `))!.c;

  const campaignTasksOpen = (await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c
    FROM tasks
    WHERE title LIKE '[CRM 90-Day] %'
      AND done = 0
  `))!.c;

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
