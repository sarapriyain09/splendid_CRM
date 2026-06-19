import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';
import type { Company } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const industry = searchParams.get('industry');
  const country = searchParams.get('country');
  const search = searchParams.get('search');

  let sql = '';
  const params: (string | number)[] = [];

  if (isPostgresDb()) {
    // Bootstrap companies from existing lead names so list is not empty after migration.
    await runStatement(`
      INSERT INTO companies (name, status)
      SELECT DISTINCT l.company_name, 'Prospect'
      FROM leads l
      WHERE l.company_name IS NOT NULL
        AND TRIM(l.company_name) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM companies c WHERE lower(c.name) = lower(l.company_name)
        )
    `);

    sql = `
      SELECT c.*, COUNT(ct.id) AS lead_count
      FROM companies c
      LEFT JOIN contacts ct ON ct.company_id = c.id
      WHERE 1=1
    `;

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (industry) {
      sql += ' AND c.industry = ?';
      params.push(industry);
    }
    if (country) {
      sql += ' AND c.country = ?';
      params.push(country);
    }
    if (search) {
      sql += ' AND (c.name ILIKE ? OR c.website ILIKE ?)';
      const q = `%${search}%`;
      params.push(q, q);
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
  } else {
    sql = `
      SELECT c.*, COUNT(l.id) as lead_count
      FROM companies c
      LEFT JOIN leads l ON l.company_id = c.id
      WHERE 1=1
    `;

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (industry) {
      sql += ' AND c.industry = ?';
      params.push(industry);
    }
    if (country) {
      sql += ' AND c.country = ?';
      params.push(country);
    }
    if (search) {
      sql += ' AND (c.name LIKE ? OR c.website LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q);
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
  }

  const companies = await queryAll(sql, params);
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as Partial<Company>;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const name = body.name.trim();
  const country = body.country?.trim() || null;
  const description = (body as { description?: string }).description;

  const existing = await queryOne('SELECT * FROM companies WHERE name = ? AND COALESCE(country, "") = COALESCE(?, "")', [name, country]);
  if (existing) return NextResponse.json(existing, { status: 200 });

  const values = [
    name,
    body.website ?? null,
    (body as { linkedin_url?: string }).linkedin_url ?? null,
    body.industry ?? null,
    country,
    body.employee_count ?? null,
    body.status ?? (isPostgresDb() ? 'Prospect' : 'prospect'),
    body.notes ?? description ?? null,
  ] as const;

  if (isPostgresDb()) {
    const created = await queryOne(
      `INSERT INTO companies
        (name, website, linkedin_url, industry, country, employee_count, status, description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       RETURNING *`,
      [...values]
    );
    return NextResponse.json(created, { status: 201 });
  }

  const sqliteValues = [
    name,
    body.website ?? null,
    body.industry ?? null,
    country,
    body.source ?? 'manual',
    body.employee_count ?? null,
    body.status ?? 'prospect',
    body.notes ?? description ?? null,
  ] as const;

  const result = await runStatement(
    `INSERT INTO companies
      (name, website, industry, country, source, employee_count, status, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [...sqliteValues]
  );

  const company = await queryOne('SELECT * FROM companies WHERE id = ?', [Number(result.lastInsertId)]);
  return NextResponse.json(company, { status: 201 });
}
