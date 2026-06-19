import { NextRequest, NextResponse } from 'next/server';
import { isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';
import { getServerSession } from 'next-auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, title, subject, description, priority, due_date, assigned_user_id, status } = await req.json();
  const subjectValue = (subject ?? title ?? '').trim();
  if (!subjectValue) return NextResponse.json({ error: 'subject required' }, { status: 400 });

  const statusValue = status ?? 'Open';
  const done = statusValue === 'Completed' ? 1 : 0;

  const values = [
    lead_id || null,
    subjectValue,
    description || null,
    priority || 'Medium',
    due_date || null,
    assigned_user_id || null,
    statusValue,
    done,
  ] as const;

  if (isPostgresDb()) {
    const task = await queryOne(
      `INSERT INTO tasks (lead_id, title, description, priority, due_date, assigned_user_id, status, done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [...values]
    );
    return NextResponse.json(task, { status: 201 });
  }

  const result = await runStatement(
    `INSERT INTO tasks (lead_id, title, description, priority, due_date, assigned_user_id, status, done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values]
  );
  const task = await queryOne(`SELECT * FROM tasks WHERE id = ?`, [Number(result.lastInsertId)]);
  return NextResponse.json(task, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const done = searchParams.get('done');
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  let sql = `
    SELECT t.*, l.company_name, u.name AS assigned_user_name
    FROM tasks t
    LEFT JOIN leads l ON t.lead_id = l.id
    LEFT JOIN users u ON u.id = t.assigned_user_id
  `;
  const params: unknown[] = [];
  const whereParts: string[] = [];
  if (done !== null) {
    whereParts.push('t.done = ?');
    params.push(Number(done));
  }
  if (status) {
    whereParts.push('t.status = ?');
    params.push(status);
  }
  if (category === 'campaign') {
    whereParts.push("t.title LIKE '[CRM 90-Day] %'");
  }
  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }
  sql += ` ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC`;

  const tasks = await queryAll(sql, params as Array<string | number | boolean | null>);
  return NextResponse.json(tasks);
}
