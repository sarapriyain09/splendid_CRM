'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
type TaskPriority = 'Low' | 'Medium' | 'High';

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  assigned_user_name: string | null;
  status: TaskStatus;
  done: number;
}

export default function TasksPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filter, setFilter] = useState<'all' | TaskStatus>('Open');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Open');

  const load = useCallback(async () => {
    const url = filter === 'all' ? '/api/tasks' : `/api/tasks?status=${encodeURIComponent(filter)}`;
    const res = await fetch(url);
    if (res.ok) setTasks(await res.json());
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(task: TaskRow, nextStatus: TaskStatus) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    load();
  }

  async function deleteTask(task: TaskRow) {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error || 'Failed to delete task');
    }
  }

  async function createTask() {
    if (!subject.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        description,
        priority,
        due_date: dueDate || null,
        status,
      }),
    });
    setSubject('');
    setDescription('');
    setDueDate('');
    setPriority('Medium');
    setStatus('Open');
    load();
  }

  const overdue = (t: TaskRow) => t.status !== 'Completed' && t.status !== 'Cancelled' && t.due_date && new Date(t.due_date) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <div className="flex gap-1 bg-white border border-slate-300 rounded-lg p-1">
          {(['Open', 'In Progress', 'Completed', 'Cancelled', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Create Task</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button onClick={createTask} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
            Save Task
          </button>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-20 text-slate-500">No tasks found.</div>
      )}

      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 ${
              overdue(t) ? 'border-red-300' : t.status === 'Completed' ? 'border-slate-200 opacity-70' : 'border-slate-200'
            }`}>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${t.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                {t.title}
              </div>
              {t.description && <div className="text-xs text-slate-600 mt-0.5">{t.description}</div>}
              <div className="text-xs text-slate-500 mt-1">Priority: {t.priority} · Assigned: {t.assigned_user_name ?? 'Unassigned'}</div>
            </div>
            {t.due_date && (
              <span className={`text-xs flex-shrink-0 ${overdue(t) ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                {overdue(t) ? 'Overdue: ' : ''}{t.due_date}
              </span>
            )}
            <select
              value={t.status}
              onChange={(e) => updateStatus(t, e.target.value as TaskStatus)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            {isAdmin && (
              <button
                onClick={() => deleteTask(t)}
                className="text-red-600 hover:text-red-700 text-xs font-medium flex-shrink-0"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
