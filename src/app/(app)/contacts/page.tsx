'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type ContactRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_name: string | null;
  status: string;
  created_at: string;
};

export default function ContactsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [query, setQuery] = useState('');

  function loadContacts() {
    const url = query.trim() ? `/api/contacts?search=${encodeURIComponent(query.trim())}` : '/api/contacts';
    fetch(url).then((r) => r.json()).then((data) => setRows(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function deleteContact(id: number, name: string) {
    if (!confirm(`Delete contact "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error || 'Failed to delete contact');
    }
  }

  const filtered = useMemo(() => rows.slice(0, 250), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts"
          className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Company</th>
              <th className="text-left px-4 py-2">Job Title</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Phone</th>
              <th className="text-left px-4 py-2">Status</th>
              {isAdmin && <th className="text-right px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/contacts/${row.id}`} className="text-blue-700 hover:text-blue-600 font-medium">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-700">{row.company_name ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.job_title ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.email ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.phone ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.status}</td>
                {isAdmin && (
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => deleteContact(row.id, row.name)}
                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-slate-500">No contacts found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
