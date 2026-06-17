import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import type { Company } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const industry = searchParams.get('industry');
  const country = searchParams.get('country');
  const search = searchParams.get('search');

  let sql = `
    SELECT c.*, COUNT(l.id) as lead_count
    FROM companies c
    LEFT JOIN leads l ON l.company_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

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

  const companies = db.prepare(sql).all(...params);
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getDb();
  const body = await req.json() as Partial<Company>;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const name = body.name.trim();
  const country = body.country?.trim() || null;

  const existing = db.prepare('SELECT * FROM companies WHERE name = ? AND COALESCE(country, "") = COALESCE(?, "")').get(name, country);
  if (existing) return NextResponse.json(existing, { status: 200 });

  const result = db.prepare(`
    INSERT INTO companies
      (name, website, industry, country, source, employee_count, status, notes, updated_at)
    VALUES
      (@name, @website, @industry, @country, @source, @employee_count, @status, @notes, datetime('now'))
  `).run({
    name,
    website: body.website ?? null,
    industry: body.industry ?? null,
    country,
    source: body.source ?? 'manual',
    employee_count: body.employee_count ?? null,
    status: body.status ?? 'prospect',
    notes: body.notes ?? null,
  });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(company, { status: 201 });
}
