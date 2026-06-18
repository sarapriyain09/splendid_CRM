import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

function hasTable(tableName: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return !!row?.name;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined;
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const contacts = db.prepare(`
    SELECT c.id, c.name, c.email, c.phone, c.job_title, c.created_at
    FROM contacts c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE l.company_id = ?
    ORDER BY c.created_at DESC
    LIMIT 200
  `).all(company.id);

  const activities = db.prepare(`
    SELECT a.id, a.activity_type, a.date, a.notes, ct.name AS contact_name
    FROM activities a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN contacts ct ON ct.id = a.contact_id
    WHERE l.company_id = ?
    ORDER BY a.date DESC, a.created_at DESC
    LIMIT 200
  `).all(company.id);

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.description, t.priority, t.due_date, t.status, t.done
    FROM tasks t
    LEFT JOIN leads l ON l.id = t.lead_id
    WHERE l.company_id = ?
    ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC
    LIMIT 200
  `).all(company.id);

  const notes = db.prepare(`
    SELECT n.id, n.content, n.created_at, u.name AS user_name
    FROM notes n
    LEFT JOIN leads l ON l.id = n.lead_id
    LEFT JOIN users u ON u.id = n.user_id
    WHERE l.company_id = ?
    ORDER BY n.created_at DESC
    LIMIT 200
  `).all(company.id);

  const documents = hasTable('documents')
    ? db.prepare(`
      SELECT id, title, file_name, file_type, file_url, created_at
      FROM documents
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(company.id)
    : [];

  const opportunities = hasTable('opportunities')
    ? db.prepare(`
      SELECT id, title, stage, value, created_at
      FROM opportunities
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(company.id)
    : [];

  const quotes = db.prepare(`
    SELECT q.id, q.quote_number, q.status, q.total, q.created_at
    FROM quotes q
    LEFT JOIN leads l ON l.id = q.lead_id
    WHERE l.company_id = ?
    ORDER BY q.created_at DESC
    LIMIT 200
  `).all(company.id);

  const campaignHistory = db.prepare(`
    SELECT a.id, a.activity_type, a.date, cp.campaign_name
    FROM activities a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN campaigns cp ON cp.id = a.campaign_id
    WHERE l.company_id = ? AND a.campaign_id IS NOT NULL
    ORDER BY a.date DESC
    LIMIT 200
  `).all(company.id);

  const callHistory = hasTable('call_logs')
    ? db.prepare(`
      SELECT id, direction, duration_seconds, created_at
      FROM call_logs
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(company.id)
    : db.prepare(`
      SELECT a.id, a.date AS created_at, a.notes
      FROM activities a
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE l.company_id = ? AND lower(a.activity_type) = 'call'
      ORDER BY a.date DESC
      LIMIT 200
    `).all(company.id);

  return NextResponse.json({
    company,
    tabs: {
      contacts,
      activities,
      tasks,
      notes,
      documents,
      opportunities,
      quotes,
      campaignHistory,
      callHistory,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const fields = Object.keys(body).filter((key) => key !== 'id');
  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const setClause = fields.map((field) => `${field} = @${field}`).join(', ');
  const db = getDb();
  db.prepare(`UPDATE companies SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({ ...body, id });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(company);
}
