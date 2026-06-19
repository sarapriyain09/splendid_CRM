'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type NoteRow = {
  id: number;
  content: string;
  created_at: string;
  user_name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
};

export default function NotesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [content, setContent] = useState('<p></p>');
  const [companyId, setCompanyId] = useState('');

  async function load() {
    const res = await fetch('/api/notes');
    if (res.ok) setRows(await res.json());
  }

  async function deleteNote(id: number) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error || 'Failed to delete note');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createNote() {
    if (!content.trim() || !companyId) return;
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, company_id: Number(companyId) }),
    });
    setContent('<p></p>');
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Notes</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Add Note</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="Company ID"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40"
          />
          <button onClick={createNote} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">
            Save Note
          </button>
        </div>
        <div
          className="min-h-28 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-slate-500 mb-1">
                {(row.contact_name || row.company_name || 'CRM')} · {row.user_name ?? 'System'} · {new Date(row.created_at).toLocaleString('en-GB')}
              </div>
              {isAdmin && (
                <button
                  onClick={() => deleteNote(row.id)}
                  className="text-red-600 hover:text-red-700 text-xs font-medium flex-shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: row.content }} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-500">No notes available.</p>}
      </div>
    </div>
  );
}
