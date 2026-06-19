import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

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

  const db = getDb();
  const items: TimelineRow[] = [];

  if (contactId) {
    const activities = db.prepare(`
      SELECT id, 'activity' AS type, activity_type AS title, notes AS description, coalesce(date, created_at) AS happened_at
      FROM activities
      WHERE contact_id = ?
      ORDER BY happened_at DESC
      LIMIT ?
    `).all(contactId, limit) as TimelineRow[];

    const notes = db.prepare(`
      SELECT id, 'note' AS type, 'Note' AS title, content AS description, created_at AS happened_at
      FROM notes
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(contactId, limit) as TimelineRow[];

    const documents = db.prepare(`
      SELECT id, 'document' AS type, title, file_name AS description, created_at AS happened_at
      FROM documents
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(contactId, limit) as TimelineRow[];

    const lead = db.prepare('SELECT lead_id FROM contacts WHERE id = ?').get(contactId) as { lead_id?: number } | undefined;
    const tasks = lead?.lead_id
      ? db.prepare(`
          SELECT id, 'task' AS type, title, description, coalesce(due_date, created_at) AS happened_at
          FROM tasks
          WHERE lead_id = ?
          ORDER BY happened_at DESC
          LIMIT ?
        `).all(lead.lead_id, limit) as TimelineRow[]
      : [];

    items.push(...activities, ...tasks, ...notes, ...documents);
  }

  if (companyId) {
    const activities = db.prepare(`
      SELECT a.id, 'activity' AS type, a.activity_type AS title, a.notes AS description, coalesce(a.date, a.created_at) AS happened_at
      FROM activities a
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE l.company_id = ?
      ORDER BY happened_at DESC
      LIMIT ?
    `).all(companyId, limit) as TimelineRow[];

    const notes = db.prepare(`
      SELECT id, 'note' AS type, 'Note' AS title, content AS description, created_at AS happened_at
      FROM notes
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(companyId, limit) as TimelineRow[];

    const documents = db.prepare(`
      SELECT id, 'document' AS type, title, file_name AS description, created_at AS happened_at
      FROM documents
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(companyId, limit) as TimelineRow[];

    const latestLead = db.prepare('SELECT id FROM leads WHERE company_id = ? ORDER BY created_at DESC LIMIT 1').get(companyId) as { id?: number } | undefined;
    const tasks = latestLead?.id
      ? db.prepare(`
          SELECT id, 'task' AS type, title, description, coalesce(due_date, created_at) AS happened_at
          FROM tasks
          WHERE lead_id = ?
          ORDER BY happened_at DESC
          LIMIT ?
        `).all(latestLead.id, limit) as TimelineRow[]
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
