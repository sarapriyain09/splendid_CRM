import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isDemoMode } from '@/lib/app-mode';

export async function GET(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?activated=invalid', req.url));
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, demo_verify_expires FROM users WHERE demo_verify_token = ? AND demo_verified = 0')
    .get(token) as { id: number; demo_verify_expires: string | null } | undefined;

  if (!user) {
    return NextResponse.redirect(new URL('/login?activated=invalid', req.url));
  }

  if (!user.demo_verify_expires || new Date(user.demo_verify_expires).getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/login?activated=expired', req.url));
  }

  db.prepare('UPDATE users SET demo_verified = 1, demo_verify_token = NULL, demo_verify_expires = NULL WHERE id = ?').run(user.id);
  return NextResponse.redirect(new URL('/login?activated=1', req.url));
}
