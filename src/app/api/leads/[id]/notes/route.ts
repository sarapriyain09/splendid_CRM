import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

// POST /api/leads/[id]/notes
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user?.email ?? '') as { id: number } | undefined;
  const result = db.prepare('INSERT INTO notes (lead_id, user_id, content) VALUES (?, ?, ?)').run(id, user?.id ?? null, content.trim());
  const note = db.prepare('SELECT n.*, u.name as user_name FROM notes n LEFT JOIN users u ON n.user_id = u.id WHERE n.id = ?').get(result.lastInsertRowid);
  return NextResponse.json(note, { status: 201 });
}
