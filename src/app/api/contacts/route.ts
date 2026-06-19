import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isPostgresDb, queryAll, queryOne, runStatement } from '@/lib/db-client';
import type { Contact } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const campaignId = searchParams.get('campaign_id');
  const industry = searchParams.get('industry');
  const country = searchParams.get('country');
  const search = searchParams.get('search');

  let sql = '';

  const params: (string | number)[] = [];
  if (isPostgresDb()) {
    sql = `
      SELECT
        c.id,
        COALESCE(NULLIF(c.display_name, ''), TRIM(c.first_name || ' ' || COALESCE(c.last_name, ''))) AS name,
        c.email,
        COALESCE(c.mobile, c.phone) AS phone,
        c.job_title,
        co.name AS company_name,
        c.status,
        c.created_at
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE 1=1
    `;

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (industry) {
      sql += ' AND co.industry = ?';
      params.push(industry);
    }
    if (country) {
      sql += ' AND c.country = ?';
      params.push(country);
    }
    if (search) {
      sql += `
        AND (
          c.first_name ILIKE ?
          OR c.last_name ILIKE ?
          OR c.display_name ILIKE ?
          OR c.email ILIKE ?
          OR co.name ILIKE ?
        )
      `;
      const q = `%${search}%`;
      params.push(q, q, q, q, q);
    }

    sql += ' ORDER BY c.created_at DESC';
  } else {
    sql = `
      SELECT c.*, l.company_name, cp.campaign_name
      FROM contacts c
      LEFT JOIN leads l ON c.lead_id = l.id
      LEFT JOIN campaigns cp ON c.campaign_id = cp.id
      WHERE 1=1
    `;

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (campaignId) {
      sql += ' AND c.campaign_id = ?';
      params.push(Number(campaignId));
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
      sql += ' AND (c.name LIKE ? OR c.email LIKE ? OR l.company_name LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY c.created_at DESC';
  }

  const contacts = await queryAll(sql, params);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as Partial<Contact>;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const fullName = body.name.trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ');

  if (isPostgresDb()) {
    const companyName = (body.company ?? '').toString().trim();
    if (!companyName) {
      return NextResponse.json({ error: 'Company is required. Create/select a company first.' }, { status: 400 });
    }

    const company = await queryOne<{ id: string }>('SELECT id FROM companies WHERE lower(name) = lower(?)', [companyName]);
    if (!company?.id) {
      return NextResponse.json({ error: 'Company not found. Create company first, then add contact.' }, { status: 400 });
    }

    const created = await queryOne(
      `INSERT INTO contacts
        (first_name, last_name, display_name, company_id, job_title, email, mobile, phone, linkedin_url, status, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING
         id,
         COALESCE(NULLIF(display_name, ''), TRIM(first_name || ' ' || COALESCE(last_name, ''))) AS name,
         company_id,
         email,
         COALESCE(mobile, phone) AS phone,
         job_title,
         status,
         created_at`,
      [
        firstName || 'Unknown',
        lastName || null,
        fullName,
        company.id,
        body.role ?? body.job_title ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.phone ?? null,
        body.linkedin ?? body.linkedin_url ?? null,
        (body.status as string) ?? 'Prospect',
        body.country ?? null,
      ]
    );
    return NextResponse.json(created, { status: 201 });
  }

  if (!body.lead_id) {
    return NextResponse.json({ error: 'lead_id is required for sqlite mode' }, { status: 400 });
  }

  const values = [
    body.lead_id,
    body.name.trim(),
    body.role ?? body.job_title ?? null,
    body.email ?? null,
    body.phone ?? null,
    body.linkedin ?? body.linkedin_url ?? null,
    body.company ?? null,
    body.job_title ?? null,
    body.linkedin_url ?? body.linkedin ?? null,
    body.industry ?? null,
    body.country ?? null,
    body.status ?? 'Pending',
    body.lead_score ?? 0,
    body.campaign_id ?? null,
    body.is_primary ? 1 : 0,
  ] as const;

  const result = await runStatement(
    `INSERT INTO contacts
      (lead_id, name, role, email, phone, linkedin, company, job_title, linkedin_url, industry, country, status, lead_score, campaign_id, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values]
  );

  const contact = await queryOne('SELECT * FROM contacts WHERE id = ?', [Number(result.lastInsertId)]);
  return NextResponse.json(contact, { status: 201 });
}
