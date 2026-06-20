import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { queryOne, runStatement } from '@/lib/db-client';

interface ImportBody {
  clientName?: string;
  company?: string;
  projectTitle?: string;
  projectUrl?: string;
  budget?: string;
  proposalDate?: string;
  proposalStatus?: string;
  vertical?: string;
  notes?: string;
  followupDate?: string;
}

const ALLOWED_STATUSES = ['upwork_prospect', 'proposal_sent', 'interview', 'opportunity', 'won', 'lost'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ImportBody;
  const projectTitle = (body.projectTitle ?? '').trim();
  const projectUrl = (body.projectUrl ?? '').trim();
  if (!projectTitle || !projectUrl) {
    return NextResponse.json({ error: 'projectTitle and projectUrl are required.' }, { status: 400 });
  }

  const proposalStatus = (body.proposalStatus ?? 'proposal_sent').trim();
  if (!ALLOWED_STATUSES.includes(proposalStatus)) {
    return NextResponse.json({ error: 'Invalid proposalStatus.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number }>('SELECT id FROM leads WHERE upwork_project_url = ?', [projectUrl]);
  if (existing) {
    return NextResponse.json({ error: 'Already imported', lead: existing }, { status: 409 });
  }

  const companyName = (body.company ?? body.clientName ?? projectTitle).trim();
  const vertical = (body.vertical ?? 'software').trim();
  const leadNotes = [
    body.notes?.trim(),
    `Upwork proposal status: ${proposalStatus}`,
    body.budget?.trim() ? `Budget: ${body.budget!.trim()}` : null,
  ].filter(Boolean).join(' | ');

  const result = await runStatement(`
    INSERT INTO leads
      (company_name, source, lead_score, status, stage, notes, vertical, created_by,
       upwork_client_name, upwork_company, upwork_project_title, upwork_project_url,
       upwork_budget, upwork_proposal_date, upwork_proposal_status, updated_at)
    VALUES
      (@company_name, 'upwork', 55, 'new', 'prospect', @notes, @vertical, @created_by,
       @upwork_client_name, @upwork_company, @upwork_project_title, @upwork_project_url,
       @upwork_budget, @upwork_proposal_date, @upwork_proposal_status, datetime('now'))
  `, {
    company_name: companyName,
    notes: leadNotes || null,
    vertical,
    created_by: (session.user as any)?.id ?? null,
    upwork_client_name: (body.clientName ?? '').trim() || null,
    upwork_company: (body.company ?? '').trim() || null,
    upwork_project_title: projectTitle,
    upwork_project_url: projectUrl,
    upwork_budget: (body.budget ?? '').trim() || null,
    upwork_proposal_date: (body.proposalDate ?? '').trim() || null,
    upwork_proposal_status: proposalStatus,
  });

  const leadId = Number(result.lastInsertId);

  const followupDate = (body.followupDate ?? '').trim() || null;
  await runStatement(`
    INSERT INTO tasks (lead_id, title, due_date, done, created_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `, [leadId, 'Upwork follow-up', followupDate]);

  const lead = await queryOne('SELECT * FROM leads WHERE id = ?', [leadId]);
  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
