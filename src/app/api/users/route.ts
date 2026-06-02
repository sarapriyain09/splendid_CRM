import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const users = db.prepare(`SELECT id, name, email, role, phone, created_at FROM users ORDER BY created_at ASC`).all();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password, role } = await req.json();
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    return NextResponse.json({ error: 'Name, email and password (min 8 chars) required.' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (existing) return NextResponse.json({ error: 'Email already in use.' }, { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run(
    name.trim(), email.toLowerCase().trim(), hash, role === 'admin' ? 'admin' : 'user'
  );
  const user = db.prepare(`SELECT id, name, email, role, created_at FROM users WHERE id = ?`).get(result.lastInsertRowid);
  return NextResponse.json(user, { status: 201 });
}
