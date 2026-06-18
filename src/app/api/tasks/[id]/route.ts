import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getServerSession } from 'next-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const task = db.prepare(`SELECT t.*, l.company_name FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id WHERE t.id = ?`).get(id);

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const db = getDb();

  if (typeof body.status === 'string' && body.done === undefined) {
    body.done = body.status === 'Completed' ? 1 : 0;
  }
  if (typeof body.done === 'number' && body.status === undefined) {
    body.status = body.done ? 'Completed' : 'Open';
  }

  const fields = Object.entries(body).map(([k]) => `${k} = ?`).join(', ');
  const values = Object.values(body);
  db.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...values, id);

  const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
