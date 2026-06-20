import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdminUser } from '@/lib/api-auth';
import { hasTable, queryAll, queryOne, runStatement } from '@/lib/db-client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const contact = await queryOne<{
      id: number;
      lead_id: number;
      company_id: number | null;
      company_name: string | null;
    }>(`
      SELECT c.*, l.company_id, l.company_name
      FROM contacts c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.id = ?
    `, [id]);

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const activities = await queryAll(`
      SELECT id, activity_type, date, notes
      FROM activities
      WHERE contact_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 100
    `, [contact.id]);

  const tasks = await queryAll(`
      SELECT t.id, t.title, t.description, t.priority, t.due_date, t.status, t.done
      FROM tasks t
      WHERE t.lead_id = ?
      ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC
      LIMIT 100
    `, [contact.lead_id]);

  const notes = await queryAll(`
      SELECT n.id, n.content, n.created_at, u.name AS user_name
      FROM notes n
      LEFT JOIN users u ON u.id = n.user_id
      WHERE n.lead_id = ?
      ORDER BY n.created_at DESC
      LIMIT 200
    `, [contact.lead_id]);

  const documents = (await hasTable('documents'))
    ? await queryAll(`
      SELECT id, title, file_name, file_type, file_url, created_at
      FROM documents
      WHERE contact_id = ? OR (company_id IS NOT NULL AND company_id = ?)
      ORDER BY created_at DESC
      LIMIT 200
    `, [contact.id, contact.company_id ?? null])
    : [];

  const opportunities = (await hasTable('opportunities'))
      ? await queryAll(`
        SELECT id, title, stage, value, created_at
        FROM opportunities
        WHERE contact_id = ? OR company_id = ?
        ORDER BY created_at DESC
        LIMIT 200
      `, [contact.id, contact.company_id ?? null])
      : [];

  const quotations = await queryAll(`
    SELECT q.id, q.quote_number, q.status, q.total, q.created_at
    FROM quotes q
    WHERE q.lead_id = ?
    ORDER BY q.created_at DESC
    LIMIT 200
  `, [contact.lead_id]);

  const marketingCampaignHistory = await queryAll(`
    SELECT a.id, a.activity_type, a.date, cp.campaign_name
    FROM activities a
    LEFT JOIN campaigns cp ON cp.id = a.campaign_id
    WHERE a.contact_id = ? AND a.campaign_id IS NOT NULL
    ORDER BY a.date DESC
    LIMIT 200
  `, [contact.id]);

  const callHistory = (await hasTable('call_logs'))
    ? await queryAll(`
      SELECT id, direction, duration_seconds, created_at
      FROM call_logs
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [contact.id])
    : await queryAll(`
      SELECT id, activity_type, date AS created_at, notes
      FROM activities
      WHERE contact_id = ? AND lower(activity_type) = 'call'
      ORDER BY date DESC
      LIMIT 200
    `, [contact.id]);

  return NextResponse.json({
    contact,
    tabs: {
      activities,
      tasks,
      notes,
      documents,
      salesOpportunities: opportunities,
      quotations,
      marketingCampaignHistory,
      callHistory,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const fields = Object.keys(body).filter((key) => key !== 'id');
  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const setClause = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => {
    const value = body[field];
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value as string | number | null;
  });

  await runStatement(`UPDATE contacts SET ${setClause} WHERE id = ?`, [...values, id]);

  const contact = await queryOne('SELECT * FROM contacts WHERE id = ?', [id]);
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await runStatement('DELETE FROM contacts WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
