import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import type { Lead } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const lead    = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  const contacts = db.prepare('SELECT * FROM contacts WHERE lead_id = ? ORDER BY is_primary DESC').all(id);
  const notes   = db.prepare('SELECT n.*, u.name as user_name FROM notes n LEFT JOIN users u ON n.user_id = u.id WHERE n.lead_id = ? ORDER BY n.created_at DESC').all(id);
  const tasks   = db.prepare('SELECT * FROM tasks WHERE lead_id = ? ORDER BY done ASC, due_date ASC').all(id);
  const quotes  = db.prepare('SELECT * FROM quotes WHERE lead_id = ? ORDER BY created_at DESC').all(id);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ lead, contacts, notes, tasks, quotes });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const body = await req.json() as Partial<Lead>;

  const fields = Object.keys(body).filter(k => k !== 'id');
  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const setClause = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE leads SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({ ...body, id });
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
