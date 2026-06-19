import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdminUser } from '@/lib/api-auth';
import { hasTable, isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const contact = isPostgresDb()
    ? await queryOne<{
      id: string;
      lead_id: null;
      company_id: string | null;
      company_name: string | null;
      name: string;
      email: string | null;
      phone: string | null;
      status: string | null;
      linkedin: string | null;
      linkedin_url: string | null;
    }>(`
      SELECT
        c.id,
        NULL::bigint AS lead_id,
        c.company_id,
        co.name AS company_name,
        COALESCE(NULLIF(c.display_name, ''), TRIM(c.first_name || ' ' || COALESCE(c.last_name, ''))) AS name,
        c.job_title,
        c.email,
        COALESCE(c.mobile, c.phone) AS phone,
        c.status,
        c.linkedin_url AS linkedin,
        c.linkedin_url
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ?
    `, [id])
    : await queryOne<{
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

  const activities = isPostgresDb()
    ? await queryAll(`
      SELECT id, type AS activity_type, date, COALESCE(description, subject) AS notes
      FROM activities
      WHERE contact_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 100
    `, [contact.id])
    : await queryAll(`
      SELECT id, activity_type, date, notes
      FROM activities
      WHERE contact_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 100
    `, [contact.id]);

  const tasks = isPostgresDb()
    ? await queryAll(`
      SELECT t.id, t.title, t.description, t.priority, t.due_date, t.status,
             CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END AS done
      FROM tasks t
      WHERE t.contact_id = ?
      ORDER BY t.due_date ASC, t.created_at DESC
      LIMIT 100
    `, [contact.id])
    : await queryAll(`
      SELECT t.id, t.title, t.description, t.priority, t.due_date, t.status, t.done
      FROM tasks t
      WHERE t.lead_id = ?
      ORDER BY t.done ASC, t.due_date ASC, t.created_at DESC
      LIMIT 100
    `, [contact.lead_id]);

  const notes = isPostgresDb()
    ? await queryAll(`
      SELECT n.id, n.content, n.created_at, u.name AS user_name
      FROM notes n
      LEFT JOIN users u ON u.id = n.created_by
      WHERE n.contact_id = ?
      ORDER BY n.created_at DESC
      LIMIT 200
    `, [contact.id])
    : await queryAll(`
      SELECT n.id, n.content, n.created_at, u.name AS user_name
      FROM notes n
      LEFT JOIN users u ON u.id = n.user_id
      WHERE n.lead_id = ?
      ORDER BY n.created_at DESC
      LIMIT 200
    `, [contact.lead_id]);

  const documents = (await hasTable('documents'))
    ? await queryAll(isPostgresDb() ? `
      SELECT id, name AS title, file_name, mime_type AS file_type, NULL::text AS file_url, created_at
      FROM documents
      WHERE contact_id = ? OR (company_id IS NOT NULL AND company_id = ?)
      ORDER BY created_at DESC
      LIMIT 200
    ` : `
      SELECT id, title, file_name, file_type, file_url, created_at
      FROM documents
      WHERE contact_id = ? OR (company_id IS NOT NULL AND company_id = ?)
      ORDER BY created_at DESC
      LIMIT 200
    `, [contact.id, contact.company_id ?? null])
    : [];

  const opportunities = isPostgresDb()
    ? []
    : (await hasTable('opportunities'))
      ? await queryAll(`
        SELECT id, title, stage, value, created_at
        FROM opportunities
        WHERE contact_id = ? OR company_id = ?
        ORDER BY created_at DESC
        LIMIT 200
      `, [contact.id, contact.company_id ?? null])
      : [];

  const quotations = isPostgresDb() ? [] : await queryAll(`
    SELECT q.id, q.quote_number, q.status, q.total, q.created_at
    FROM quotes q
    WHERE q.lead_id = ?
    ORDER BY q.created_at DESC
    LIMIT 200
  `, [contact.lead_id]);

  const marketingCampaignHistory = isPostgresDb() ? [] : await queryAll(`
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
    : await queryAll(isPostgresDb() ? `
      SELECT id, type AS activity_type, date AS created_at, COALESCE(description, subject) AS notes
      FROM activities
      WHERE contact_id = ? AND lower(type::text) = 'call'
      ORDER BY date DESC
      LIMIT 200
    ` : `
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

  if (isPostgresDb()) {
    const mapped: Record<string, string> = {
      status: 'status',
      linkedin_url: 'linkedin_url',
      email: 'email',
      phone: 'phone',
      name: 'display_name',
      job_title: 'job_title',
    };
    const companyName = typeof body.company_name === 'string' ? body.company_name.trim() : '';
    const bodyWithoutCompany = { ...body } as Record<string, unknown>;
    delete bodyWithoutCompany.company_name;
    delete bodyWithoutCompany.company;

    const effectiveFields = Object.keys(bodyWithoutCompany).filter((key) => key !== 'id');
    const pgFields = effectiveFields.map((f) => mapped[f]).filter(Boolean);
    const values = effectiveFields
      .filter((f) => mapped[f])
      .map((field) => {
        const value = body[field];
        return value as string | number | null;
      });

    if (companyName) {
      let company = await queryOne<{ id: string }>('SELECT id FROM companies WHERE lower(name) = lower(?)', [companyName]);
      if (!company) {
        company = await queryOne<{ id: string }>(
          `INSERT INTO companies (name, status) VALUES (?, 'Prospect') RETURNING id`,
          [companyName]
        );
      }
      if (company?.id) {
        pgFields.push('company_id');
        values.push(company.id);
      }
    } else if (body.company_name === '' || body.company === '') {
      pgFields.push('company_id');
      values.push(null);
    }

    if (!pgFields.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const finalSetClause = pgFields.map((field) => `${field} = ?`).join(', ');
    await runStatement(`UPDATE contacts SET ${finalSetClause} WHERE id = ?`, [...values, id]);
    const updated = await queryOne(`
      SELECT
        c.id,
        NULL::bigint AS lead_id,
        c.company_id,
        co.name AS company_name,
        COALESCE(NULLIF(c.display_name, ''), TRIM(c.first_name || ' ' || COALESCE(c.last_name, ''))) AS name,
        c.job_title,
        c.email,
        COALESCE(c.mobile, c.phone) AS phone,
        c.status,
        c.linkedin_url AS linkedin,
        c.linkedin_url
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ?
    `, [id]);

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
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
