import { NextRequest, NextResponse } from 'next/server';
import { runStatement } from '@/lib/db-client';
import { isAdminUser } from '@/lib/api-auth';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await runStatement('DELETE FROM activities WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
