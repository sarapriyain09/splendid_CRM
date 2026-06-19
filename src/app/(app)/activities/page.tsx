'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const TYPES = ['Call', 'Meeting', 'Email', 'Visit', 'Note'] as const;

type ActivityRow = {
  id: number;
  activity_type: string;
  date: string;
  notes: string | null;
  contact_name?: string | null;
  company_name?: string | null;
};

export default function ActivitiesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [activityType, setActivityType] = useState<string>('');
  const [notes, setNotes] = useState('');

  async function load(type?: string) {
    const q = type ? `?activity_type=${encodeURIComponent(type.toLowerCase())}` : '';
    const res = await fetch(`/api/activities${q}`);
    if (res.ok) setRows(await res.json());
  }

  async function deleteActivity(id: number) {
    if (!confirm('Delete this activity? This cannot be undone.')) return;
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error || 'Failed to delete activity');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createActivity() {
    if (!activityType) return;
    await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_type: activityType.toLowerCase(), notes }),
    });
    setNotes('');
    load(activityType);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Activities</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Add Activity</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select type</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="flex-1 min-w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={createActivity} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">
            Save
          </button>
          <button
            onClick={() => load(activityType)}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Filter
          </button>
          <button
            onClick={() => { setActivityType(''); load(); }}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Timeline</h2>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="border-l-2 border-blue-200 pl-4 py-1 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800">{row.activity_type}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {(row.contact_name || row.company_name || 'CRM')} · {new Date(row.date).toLocaleString('en-GB')}
                </div>
                {row.notes && <p className="text-sm text-slate-700 mt-1">{row.notes}</p>}
              </div>
              {isAdmin && (
                <button
                  onClick={() => deleteActivity(row.id)}
                  className="text-red-600 hover:text-red-700 text-xs font-medium flex-shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">No activities recorded.</p>}
        </div>
      </div>
    </div>
  );
}
