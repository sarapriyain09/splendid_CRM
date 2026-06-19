import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get('contact_id');
  const companyId = searchParams.get('company_id');

  let sql = `
    SELECT n.id, n.content, n.created_at, n.lead_id, n.contact_id, n.company_id,
           u.name AS user_name, c.name AS contact_name, co.name AS company_name
    FROM notes n
    LEFT JOIN users u ON u.id = n.user_id
    LEFT JOIN contacts c ON c.id = n.contact_id
    LEFT JOIN companies co ON co.id = n.company_id
    WHERE 1=1
  `;

  const params: Array<number | string> = [];
  if (contactId) {
    sql += ' AND n.contact_id = ?';
    params.push(Number(contactId));
  }
  if (companyId) {
    sql += ' AND n.company_id = ?';
    params.push(Number(companyId));
  }

  sql += ' ORDER BY n.created_at DESC';

  const notes = await queryAll(sql, params);
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = (await req.json()) as {
    content?: string;
    contact_id?: number;
    company_id?: number;
    lead_id?: number;
  };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const contactId = body.contact_id ?? null;
  const companyId = body.company_id ?? null;
  let leadId = body.lead_id ?? null;

  if (!leadId && contactId) {
    const row = await queryOne<{ lead_id?: number }>('SELECT lead_id FROM contacts WHERE id = ?', [contactId]);
    leadId = row?.lead_id ?? null;
  }

  if (!leadId && companyId) {
    const row = await queryOne<{ id?: number }>('SELECT id FROM leads WHERE company_id = ? ORDER BY created_at DESC LIMIT 1', [companyId]);
    leadId = row?.id ?? null;
  }

  if (!leadId) {
    return NextResponse.json(
      { error: 'Unable to resolve related lead for this note. Link the note to a contact or company with an existing lead.' },
      { status: 400 }
    );
  }

  const user = session.user as { id?: number } | undefined;

  if (isPostgresDb()) {
    const note = await queryOne(
      `INSERT INTO notes (lead_id, user_id, content, contact_id, company_id)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, content, created_at, lead_id, contact_id, company_id`,
      [leadId, user?.id ?? null, body.content.trim(), contactId, companyId]
    );
    return NextResponse.json(note, { status: 201 });
  }

  const result = await runStatement(
    `INSERT INTO notes (lead_id, user_id, content, contact_id, company_id)
     VALUES (?, ?, ?, ?, ?)`,
    [leadId, user?.id ?? null, body.content.trim(), contactId, companyId]
  );

  const note = await queryOne(
    'SELECT id, content, created_at, lead_id, contact_id, company_id FROM notes WHERE id = ?',
    [Number(result.lastInsertId)]
  );

  return NextResponse.json(note, { status: 201 });
}
