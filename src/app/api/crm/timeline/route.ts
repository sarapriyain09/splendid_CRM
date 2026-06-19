import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { queryAll, queryOne } from '@/lib/db-client';

type TimelineRow = {
  id: string;
  type: 'activity' | 'task' | 'note' | 'document';
  title: string;
  description: string | null;
  happened_at: string;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contactId = Number(searchParams.get('contact_id'));
  const companyId = Number(searchParams.get('company_id'));
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 500);

  if (!contactId && !companyId) {
    return NextResponse.json({ error: 'contact_id or company_id is required' }, { status: 400 });
  }

  const items: TimelineRow[] = [];

  if (contactId) {
    const activities = await queryAll<TimelineRow>(`
      SELECT id, 'activity' AS type, activity_type AS title, notes AS description, coalesce(date, created_at) AS happened_at
      FROM activities
      WHERE contact_id = ?
      ORDER BY happened_at DESC
      LIMIT ?
    `, [contactId, limit]);

    const notes = await queryAll<TimelineRow>(`
      SELECT id, 'note' AS type, 'Note' AS title, content AS description, created_at AS happened_at
      FROM notes
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [contactId, limit]);

    const documents = await queryAll<TimelineRow>(`
      SELECT id, 'document' AS type, title, file_name AS description, created_at AS happened_at
      FROM documents
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [contactId, limit]);

    const lead = await queryOne<{ lead_id?: number }>('SELECT lead_id FROM contacts WHERE id = ?', [contactId]);
    const tasks = lead?.lead_id
      ? await queryAll<TimelineRow>(`
          SELECT id, 'task' AS type, title, description, coalesce(due_date, created_at) AS happened_at
          FROM tasks
          WHERE lead_id = ?
          ORDER BY happened_at DESC
          LIMIT ?
        `, [lead.lead_id, limit])
      : [];

    items.push(...activities, ...tasks, ...notes, ...documents);
  }

  if (companyId) {
    const activities = await queryAll<TimelineRow>(`
      SELECT a.id, 'activity' AS type, a.activity_type AS title, a.notes AS description, coalesce(a.date, a.created_at) AS happened_at
      FROM activities a
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE l.company_id = ?
      ORDER BY happened_at DESC
      LIMIT ?
    `, [companyId, limit]);

    const notes = await queryAll<TimelineRow>(`
      SELECT id, 'note' AS type, 'Note' AS title, content AS description, created_at AS happened_at
      FROM notes
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [companyId, limit]);

    const documents = await queryAll<TimelineRow>(`
      SELECT id, 'document' AS type, title, file_name AS description, created_at AS happened_at
      FROM documents
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [companyId, limit]);

    const latestLead = await queryOne<{ id?: number }>('SELECT id FROM leads WHERE company_id = ? ORDER BY created_at DESC LIMIT 1', [companyId]);
    const tasks = latestLead?.id
      ? await queryAll<TimelineRow>(`
          SELECT id, 'task' AS type, title, description, coalesce(due_date, created_at) AS happened_at
          FROM tasks
          WHERE lead_id = ?
          ORDER BY happened_at DESC
          LIMIT ?
        `, [latestLead.id, limit])
      : [];

    items.push(...activities, ...tasks, ...notes, ...documents);
  }

  const deduped = new Map<string, TimelineRow>();
  for (const item of items) {
    deduped.set(`${item.type}:${item.id}`, item);
  }

  const timeline = Array.from(deduped.values())
    .sort((a, b) => (b.happened_at ?? '').localeCompare(a.happened_at ?? ''))
    .slice(0, limit);

  return NextResponse.json({
    count: timeline.length,
    timeline,
  });
}
