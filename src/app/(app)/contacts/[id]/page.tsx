'use client';

import { useEffect, useMemo, useState } from 'react';

type TabKey =
  | 'activities'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'salesOpportunities'
  | 'quotations'
  | 'marketingCampaignHistory'
  | 'callHistory';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'activities', label: 'Activities' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'documents', label: 'Documents' },
  { key: 'salesOpportunities', label: 'Sales Opportunities (Read-only)' },
  { key: 'quotations', label: 'Quotations (Read-only)' },
  { key: 'marketingCampaignHistory', label: 'Marketing Campaign History (Read-only)' },
  { key: 'callHistory', label: 'Call History (Read-only)' },
];

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const [active, setActive] = useState<TabKey>('activities');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/contacts/${params.id}`).then((r) => r.json()).then(setData);
  }, [params.id]);

  const rows = useMemo(() => {
    if (!data?.tabs) return [];
    return Array.isArray(data.tabs[active]) ? data.tabs[active] : [];
  }, [data, active]);

  if (!data?.contact) {
    return <div className="text-slate-600">Loading contact...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{data.contact.name}</h1>
        <p className="text-sm text-slate-600 mt-1">{data.contact.email ?? '-'} · {data.contact.phone ?? '-'}</p>
      </div>

      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm ${active === tab.key ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No records in this tab.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row: Record<string, unknown>, idx: number) => (
              <div key={String(row.id ?? idx)} className="border border-slate-100 rounded-lg p-3 bg-slate-50 text-sm">
                <pre className="whitespace-pre-wrap text-slate-700">{JSON.stringify(row, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
