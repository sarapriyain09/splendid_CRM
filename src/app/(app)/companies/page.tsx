'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CompanyRow = {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  status: string;
  lead_count?: number;
};

export default function CompaniesPage() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const url = query.trim() ? `/api/companies?search=${encodeURIComponent(query.trim())}` : '/api/companies';
    fetch(url).then((r) => r.json()).then((data) => setRows(Array.isArray(data) ? data : []));
  }, [query]);

  const visible = useMemo(() => rows.slice(0, 250), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies"
          className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Industry</th>
              <th className="text-left px-4 py-2">Country</th>
              <th className="text-left px-4 py-2">Website</th>
              <th className="text-left px-4 py-2">Contacts/Leads</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/companies/${row.id}`} className="text-blue-700 hover:text-blue-600 font-medium">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-700">{row.industry ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.country ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.website ?? '-'}</td>
                <td className="px-4 py-2 text-slate-700">{row.lead_count ?? 0}</td>
                <td className="px-4 py-2 text-slate-700">{row.status}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No companies found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
