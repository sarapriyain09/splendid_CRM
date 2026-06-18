import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

const ALLOWED_TYPES = ['pdf', 'docx', 'xlsx', 'image'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get('contact_id');
  const companyId = searchParams.get('company_id');

  let sql = `
    SELECT d.*, c.name AS contact_name, co.name AS company_name
    FROM documents d
    LEFT JOIN contacts c ON c.id = d.contact_id
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE 1=1
  `;
  const params: Array<number | string> = [];

  if (contactId) {
    sql += ' AND d.contact_id = ?';
    params.push(Number(contactId));
  }
  if (companyId) {
    sql += ' AND d.company_id = ?';
    params.push(Number(companyId));
  }

  sql += ' ORDER BY d.created_at DESC';
  const docs = db.prepare(sql).all(...params);
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = (await req.json()) as {
    title?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    file_url?: string;
    contact_id?: number;
    company_id?: number;
  };

  if (!body.title?.trim() || !body.file_name?.trim() || !body.file_type?.trim()) {
    return NextResponse.json({ error: 'title, file_name and file_type are required' }, { status: 400 });
  }

  const type = body.file_type.toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: `file_type must be one of: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
  }

  const user = session.user as { id?: number } | undefined;
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO documents (title, file_name, file_type, file_size, file_url, contact_id, company_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.title.trim(),
    body.file_name.trim(),
    type,
    body.file_size ?? null,
    body.file_url ?? null,
    body.contact_id ?? null,
    body.company_id ?? null,
    user?.id ?? null
  );

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(doc, { status: 201 });
}
