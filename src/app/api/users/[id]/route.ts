import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getServerSession } from 'next-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { phone?: string };
  const db = getDb();
  db.prepare(`UPDATE users SET phone = ? WHERE id = ?`).run(body.phone?.trim() ?? null, id);
  const user = db.prepare(`SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?`).get(id);
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Prevent deleting the last admin
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as { id: number }[];
  const target = db.prepare(`SELECT role FROM users WHERE id = ?`).get(id) as { role: string } | undefined;
  if (target?.role === 'admin' && admins.length <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last admin.' }, { status: 400 });
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
