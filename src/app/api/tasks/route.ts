import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getServerSession } from 'next-auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, title, due_date } = await req.json();
  if (!lead_id || !title?.trim()) return NextResponse.json({ error: 'lead_id and title required' }, { status: 400 });

  const db = getDb();
  const result = db.prepare(`INSERT INTO tasks (lead_id, title, due_date) VALUES (?, ?, ?)`).run(lead_id, title.trim(), due_date || null);
  const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(result.lastInsertRowid);
  return NextResponse.json(task, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const done = searchParams.get('done');
  const db = getDb();

  let sql = `SELECT t.*, l.company_name FROM tasks t JOIN leads l ON t.lead_id = l.id`;
  const params: unknown[] = [];
  if (done !== null) { sql += ` WHERE t.done = ?`; params.push(Number(done)); }
  sql += ` ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC`;

  const tasks = db.prepare(sql).all(...params);
  return NextResponse.json(tasks);
}
