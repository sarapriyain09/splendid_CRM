'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type TaskDetail = {
  id: number;
  lead_id: number | null;
  title: string;
  due_date: string | null;
  done: number;
  created_at: string;
  company_name: string | null;
};

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTask() {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/tasks/${params.id}`);
    if (!res.ok) {
      setError('Task not found or unavailable.');
      setLoading(false);
      return;
    }
    const data = (await res.json()) as TaskDetail;
    setTask(data);
    setLoading(false);
  }

  useEffect(() => {
    loadTask();
  }, [params.id]);

  async function toggleDone() {
    if (!task) return;
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: task.done ? 0 : 1 }),
    });
    loadTask();
  }

  async function deleteTask() {
    if (!task) return;
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    router.push('/tasks');
  }

  if (loading) {
    return <div className="text-slate-400">Loading task...</div>;
  }

  if (error || !task) {
    return (
      <div className="space-y-3">
        <p className="text-red-400">{error || 'Task not found.'}</p>
        <Link href="/tasks" className="text-blue-400 hover:text-blue-300">Back to tasks</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Task Details</h1>
          <p className="text-xs text-slate-500">Task #{task.id} · Created {task.created_at}</p>
        </div>
        <Link href="/tasks" className="text-sm text-blue-400 hover:text-blue-300">← Back to tasks</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">Title</div>
          <div className={`text-lg font-medium ${task.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
            {task.title}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-1">Status</div>
            <div className={task.done ? 'text-emerald-400' : 'text-amber-400'}>
              {task.done ? 'Completed' : 'Open'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Due Date</div>
            <div className="text-slate-300">{task.due_date ?? 'No due date'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Linked Lead</div>
            <div className="text-slate-300">
              {task.lead_id ? (
                <Link href={`/leads/${task.lead_id}`} className="text-blue-400 hover:text-blue-300">
                  {task.company_name ?? `Lead ${task.lead_id}`}
                </Link>
              ) : (
                'Campaign task (no lead linked)'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={toggleDone}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
          >
            {task.done ? 'Mark Open' : 'Mark Complete'}
          </button>
          <button
            onClick={deleteTask}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg"
          >
            Delete Task
          </button>
        </div>
      </div>
    </div>
  );
}
