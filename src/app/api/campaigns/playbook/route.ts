import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import { buildWeeklyTaskPlan, CRM_DAILY_ACTIVITIES, CRM_WEEKLY_ACTIVITIES } from '@/lib/campaign-playbook';

interface CreatePlaybookBody {
  startDate?: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  return NextResponse.json({
    daily: CRM_DAILY_ACTIVITIES,
    weekly: CRM_WEEKLY_ACTIVITIES,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreatePlaybookBody;
  const startDate = body.startDate && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
    ? body.startDate
    : new Date().toISOString().slice(0, 10);

  const db = getDb();
  const plan = buildWeeklyTaskPlan(startDate);

  const insertTask = db.prepare(`
    INSERT INTO tasks (lead_id, user_id, title, due_date)
    VALUES (?, ?, ?, ?)
  `);

  const userId = Number((session.user as { id?: string | number } | undefined)?.id ?? 0) || null;

  const insertMany = db.transaction((items: typeof plan) => {
    for (const item of items) {
      insertTask.run(null, userId, item.title, item.due_date);
    }
  });

  insertMany(plan);

  return NextResponse.json({
    ok: true,
    created: plan.length,
    startDate,
    endDate: plan[plan.length - 1]?.due_date ?? startDate,
  });
}
