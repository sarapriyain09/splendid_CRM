'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ActivityRow = {
  id: number;
  activity_type: string;
  date: string;
  notes: string | null;
  contact_name?: string | null;
  company_name?: string | null;
};

type TaskRow = {
  id: number;
  title: string;
  due_date: string | null;
  done: number;
  status?: string | null;
};

type ContactRow = { id: number; name: string; company_name?: string | null; created_at: string };
type CompanyRow = { id: number; name: string; created_at: string };
type DocumentRow = { id: number; title: string; file_type: string; created_at: string };

export default function DashboardPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [aRes, tRes, cRes, coRes, dRes] = await Promise.all([
          fetch('/api/activities'),
          fetch('/api/tasks?done=0'),
          fetch('/api/contacts'),
          fetch('/api/companies'),
          fetch('/api/documents'),
        ]);

        if (aRes.ok) setActivities(await aRes.json());
        if (tRes.ok) setTasks(await tRes.json());
        if (cRes.ok) setContacts(await cRes.json());
        if (coRes.ok) setCompanies(await coRes.json());
        if (dRes.ok) setDocuments(await dRes.json());
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const upcomingTasks = useMemo(
    () => tasks.filter((t) => !!t.due_date).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')).slice(0, 6),
    [tasks]
  );
  const myTasks = useMemo(
    () => tasks.filter((t) => (t.status ?? '').toLowerCase() !== 'cancelled').slice(0, 6),
    [tasks]
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
        <Link href="/contacts" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
          Open Contacts
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Customer Statistics', value: contacts.length + companies.length },
          { label: 'Recent Activities', value: activities.length },
          { label: 'Upcoming Tasks', value: upcomingTasks.length },
          { label: 'Recent Documents', value: documents.length },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Recent Activities</h2>
            <Link href="/activities" className="text-xs text-blue-600 hover:text-blue-500">View all</Link>
          </div>
          <div className="space-y-2">
            {activities.slice(0, 6).map((a) => (
              <div key={a.id} className="px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                <div className="text-sm font-medium text-slate-800">{a.activity_type}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {(a.contact_name || a.company_name || 'CRM')} · {new Date(a.date).toLocaleString('en-GB')}
                </div>
              </div>
            ))}
            {activities.length === 0 && <p className="text-sm text-slate-500">No activities yet.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Upcoming Tasks</h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-500">View all</Link>
          </div>
          <div className="space-y-2">
            {upcomingTasks.map((t) => (
              <div key={t.id} className="px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                <div className="text-sm font-medium text-slate-800">{t.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">Due {t.due_date ?? 'Not set'}</div>
              </div>
            ))}
            {upcomingTasks.length === 0 && <p className="text-sm text-slate-500">No upcoming tasks.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">My Tasks</h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-500">Open tasks</Link>
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="text-sm text-slate-700 border-b border-slate-100 pb-2">{t.title}</div>
            ))}
            {myTasks.length === 0 && <p className="text-sm text-slate-500">No tasks assigned.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Recently Added Contacts</h2>
            <Link href="/contacts" className="text-xs text-blue-600 hover:text-blue-500">View contacts</Link>
          </div>
          <div className="space-y-2">
            {contacts.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="block text-sm text-slate-700 hover:text-blue-600">
                {c.name}
              </Link>
            ))}
            {contacts.length === 0 && <p className="text-sm text-slate-500">No contacts yet.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Recently Added Companies</h2>
            <Link href="/companies" className="text-xs text-blue-600 hover:text-blue-500">View companies</Link>
          </div>
          <div className="space-y-2">
            {companies.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="block text-sm text-slate-700 hover:text-blue-600">
                {c.name}
              </Link>
            ))}
            {companies.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Recent Documents</h2>
          <Link href="/documents" className="text-xs text-blue-600 hover:text-blue-500">View documents</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.slice(0, 6).map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
              <div className="text-sm text-slate-800 font-medium truncate">{d.title}</div>
              <div className="text-xs text-slate-500">{d.file_type}</div>
            </div>
          ))}
          {documents.length === 0 && <p className="text-sm text-slate-500">No documents yet.</p>}
        </div>
      </div>
    </div>
  );
}
