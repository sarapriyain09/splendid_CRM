'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface TaskWithLead {
  id: number; lead_id: number | null; title: string; due_date: string | null;
  done: number; created_at: string; company_name: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithLead[]>([]);
  const [filter, setFilter] = useState<'all'|'open'|'done'|'campaign'>('open');

  const load = useCallback(async () => {
    let url = '/api/tasks';
    if (filter === 'open') url = '/api/tasks?done=0';
    if (filter === 'done') url = '/api/tasks?done=1';
    if (filter === 'campaign') url = '/api/tasks?category=campaign';
    const res = await fetch(url);
    if (res.ok) setTasks(await res.json());
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function toggle(task: TaskWithLead) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: task.done ? 0 : 1 }),
    });
    load();
  }

  const overdue = (t: TaskWithLead) => !t.done && t.due_date && new Date(t.due_date) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-100">Tasks</h1>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['open','campaign','all','done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                filter === f ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {f === 'campaign' ? 'Campaign Tasks' : f}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-20 text-slate-600">No tasks found.</div>
      )}

      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 bg-slate-900 border rounded-xl px-4 py-3 ${
              overdue(t) ? 'border-red-900' : t.done ? 'border-slate-800 opacity-60' : 'border-slate-700'
            }`}>
            <button onClick={() => toggle(t)}
              className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                t.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 hover:border-emerald-500'
              }`}>
              {t.done ? '✓' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{t.title}</span>
              {t.lead_id ? (
                <Link href={`/leads/${t.lead_id}`} className="ml-2 text-xs text-blue-400 hover:text-blue-300">
                  {t.company_name ?? 'Linked lead'}
                </Link>
              ) : (
                <span className="ml-2 text-xs text-slate-500">Campaign task</span>
              )}
            </div>
            {t.due_date && (
              <span className={`text-xs flex-shrink-0 ${overdue(t) ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                {overdue(t) ? 'Overdue: ' : ''}{t.due_date}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
