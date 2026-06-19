import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

type SearchItem = {
  id: number;
  title: string;
  subtitle?: string | null;
  type: 'contact' | 'company' | 'activity' | 'task' | 'note' | 'document';
  created_at?: string;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 8), 1), 50);

  if (!q) {
    return NextResponse.json({
      query: '',
      contacts: [],
      companies: [],
      activities: [],
      tasks: [],
      notes: [],
      documents: [],
    });
  }

  const like = `%${q}%`;
  const db = getDb();

  const contacts = db.prepare(`
    SELECT id, name AS title, email AS subtitle, created_at
    FROM contacts
    WHERE name LIKE ? OR email LIKE ? OR company LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, like, like, limit) as Array<Omit<SearchItem, 'type'>>;

  const companies = db.prepare(`
    SELECT id, name AS title, industry AS subtitle, created_at
    FROM companies
    WHERE name LIKE ? OR industry LIKE ? OR website LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, like, like, limit) as Array<Omit<SearchItem, 'type'>>;

  const activities = db.prepare(`
    SELECT id, activity_type AS title, notes AS subtitle, created_at
    FROM activities
    WHERE activity_type LIKE ? OR notes LIKE ?
    ORDER BY date DESC, created_at DESC
    LIMIT ?
  `).all(like, like, limit) as Array<Omit<SearchItem, 'type'>>;

  const tasks = db.prepare(`
    SELECT id, title, description AS subtitle, created_at
    FROM tasks
    WHERE title LIKE ? OR description LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, like, limit) as Array<Omit<SearchItem, 'type'>>;

  const notes = db.prepare(`
    SELECT id, substr(content, 1, 120) AS title, content AS subtitle, created_at
    FROM notes
    WHERE content LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, limit) as Array<Omit<SearchItem, 'type'>>;

  const documents = db.prepare(`
    SELECT id, title, file_name AS subtitle, created_at
    FROM documents
    WHERE title LIKE ? OR file_name LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, like, limit) as Array<Omit<SearchItem, 'type'>>;

  return NextResponse.json({
    query: q,
    contacts: contacts.map((item) => ({ ...item, type: 'contact' as const })),
    companies: companies.map((item) => ({ ...item, type: 'company' as const })),
    activities: activities.map((item) => ({ ...item, type: 'activity' as const })),
    tasks: tasks.map((item) => ({ ...item, type: 'task' as const })),
    notes: notes.map((item) => ({ ...item, type: 'note' as const })),
    documents: documents.map((item) => ({ ...item, type: 'document' as const })),
  });
}
