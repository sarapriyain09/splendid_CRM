import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasTable, isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const company = await queryOne<{ id: number | string; name: string }>('SELECT * FROM companies WHERE id = ?', [id]) as
    | { id: number; name: string }
    | undefined;
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const contacts = isPostgresDb()
    ? await queryAll(`
      SELECT
        c.id,
        COALESCE(NULLIF(c.display_name, ''), TRIM(c.first_name || ' ' || COALESCE(c.last_name, ''))) AS name,
        c.email,
        COALESCE(c.mobile, c.phone) AS phone,
        c.job_title,
        c.created_at
      FROM contacts c
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC
      LIMIT 200
    `, [company.id])
    : await queryAll(`
      SELECT c.id, c.name, c.email, c.phone, c.job_title, c.created_at
      FROM contacts c
      LEFT JOIN leads l ON l.id = c.lead_id
      WHERE l.company_id = ?
      ORDER BY c.created_at DESC
      LIMIT 200
    `, [company.id]);

  const activities = isPostgresDb()
    ? await queryAll(`
      SELECT
        a.id,
        a.type AS activity_type,
        a.date,
        COALESCE(a.description, a.subject) AS notes,
        COALESCE(NULLIF(ct.display_name, ''), TRIM(ct.first_name || ' ' || COALESCE(ct.last_name, ''))) AS contact_name
      FROM activities a
      LEFT JOIN contacts ct ON ct.id = a.contact_id
      WHERE a.company_id = ?
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT 200
    `, [company.id])
    : await queryAll(`
      SELECT a.id, a.activity_type, a.date, a.notes, ct.name AS contact_name
      FROM activities a
      LEFT JOIN leads l ON l.id = a.lead_id
      LEFT JOIN contacts ct ON ct.id = a.contact_id
      WHERE l.company_id = ?
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT 200
    `, [company.id]);

  const tasks = isPostgresDb()
    ? await queryAll(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.due_date,
        t.status,
        CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END AS done
      FROM tasks t
      WHERE t.company_id = ?
      ORDER BY t.due_date ASC, t.created_at DESC
      LIMIT 200
    `, [company.id])
    : await queryAll(`
      SELECT t.id, t.title, t.description, t.priority, t.due_date, t.status, t.done
      FROM tasks t
      LEFT JOIN leads l ON l.id = t.lead_id
      WHERE l.company_id = ?
      ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC
      LIMIT 200
    `, [company.id]);

  const notes = isPostgresDb()
    ? await queryAll(`
      SELECT n.id, n.content, n.created_at, u.name AS user_name
      FROM notes n
      LEFT JOIN users u ON u.id = n.created_by
      WHERE n.company_id = ?
      ORDER BY n.created_at DESC
      LIMIT 200
    `, [company.id])
    : await queryAll(`
      SELECT n.id, n.content, n.created_at, u.name AS user_name
      FROM notes n
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN users u ON u.id = n.user_id
      WHERE l.company_id = ?
      ORDER BY n.created_at DESC
      LIMIT 200
    `, [company.id]);

  const documents = (await hasTable('documents'))
    ? await queryAll(isPostgresDb() ? `
      SELECT id, name AS title, file_name, mime_type AS file_type, NULL::text AS file_url, created_at
      FROM documents
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    ` : `
      SELECT id, title, file_name, file_type, file_url, created_at
      FROM documents
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [company.id])
    : [];

  const opportunities = isPostgresDb() ? [] : (await hasTable('opportunities'))
    ? await queryAll(`
      SELECT id, title, stage, value, created_at
      FROM opportunities
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [company.id])
    : [];

  const quotes = isPostgresDb() ? [] : await queryAll(`
    SELECT q.id, q.quote_number, q.status, q.total, q.created_at
    FROM quotes q
    LEFT JOIN leads l ON l.id = q.lead_id
    WHERE l.company_id = ?
    ORDER BY q.created_at DESC
    LIMIT 200
  `, [company.id]);

  const campaignHistory = isPostgresDb() ? [] : await queryAll(`
    SELECT a.id, a.activity_type, a.date, cp.campaign_name
    FROM activities a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN campaigns cp ON cp.id = a.campaign_id
    WHERE l.company_id = ? AND a.campaign_id IS NOT NULL
    ORDER BY a.date DESC
    LIMIT 200
  `, [company.id]);

  const callHistory = (await hasTable('call_logs'))
    ? await queryAll(`
      SELECT id, direction, duration_seconds, created_at
      FROM call_logs
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [company.id])
    : await queryAll(isPostgresDb() ? `
      SELECT a.id, a.date AS created_at, COALESCE(a.description, a.subject) AS notes
      FROM activities a
      WHERE a.company_id = ? AND lower(a.type::text) = 'call'
      ORDER BY a.date DESC
      LIMIT 200
    ` : `
      SELECT a.id, a.date AS created_at, a.notes
      FROM activities a
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE l.company_id = ? AND lower(a.activity_type) = 'call'
      ORDER BY a.date DESC
      LIMIT 200
    `, [company.id]);

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

  const postgres = isPostgresDb();
  const fields = Object.keys(body).filter((key) => key !== 'id');
  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const setClause = fields
    .map((field) => {
      // Cast status to the enum type on PostgreSQL.
      if (postgres && field === 'status') return `${field} = ?::crm_company_status`;
      return `${field} = ?`;
    })
    .join(', ');
  const values = fields.map((field) => {
    const value = body[field];
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value as string | number | null;
  });
  await runStatement(
    postgres
      ? `UPDATE companies SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE companies SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );

  const company = await queryOne('SELECT * FROM companies WHERE id = ?', [id]);
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(company);
}
