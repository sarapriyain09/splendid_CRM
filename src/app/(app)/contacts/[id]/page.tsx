'use client';

import { useParams } from 'next/navigation';
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

type ContactDetailResponse = {
  contact?: {
    id: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    linkedin?: string | null;
    linkedin_url?: string | null;
  };
  tabs?: Partial<Record<TabKey, Record<string, unknown>[]>>;
  error?: string;
};

const CONTACT_STATUS_OPTIONS = ['Pending', 'Connected', 'Message1', 'Interested', 'Qualified'];

export default function ContactDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [active, setActive] = useState<TabKey>('activities');
  const [data, setData] = useState<ContactDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Pending');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadContact = async () => {
      try {
        setError(null);
        const response = await fetch(`/api/contacts/${id}`);
        const payload = (await response.json()) as ContactDetailResponse;

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load contact');
        }

        if (!cancelled) {
          setData(payload);
          setStatus(payload.contact?.status ?? 'Pending');
          setLinkedinUrl(payload.contact?.linkedin_url ?? payload.contact?.linkedin ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Failed to load contact');
        }
      }
    };

    loadContact();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const rows = useMemo(() => {
    if (!data?.tabs) return [];
    return Array.isArray(data.tabs[active]) ? data.tabs[active] : [];
  }, [data, active]);

  const saveContact = async () => {
    if (!id || !data?.contact?.id) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          linkedin_url: linkedinUrl.trim() || null,
          linkedin: linkedinUrl.trim() || null,
        }),
      });

      const payload = (await response.json()) as Record<string, unknown> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update contact');
      }

      setData((prev) => {
        if (!prev?.contact) return prev;
        return {
          ...prev,
          contact: {
            ...prev.contact,
            status: (payload.status as string | null | undefined) ?? status,
            linkedin_url: (payload.linkedin_url as string | null | undefined) ?? (linkedinUrl.trim() || null),
            linkedin: (payload.linkedin as string | null | undefined) ?? (linkedinUrl.trim() || null),
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!data?.contact) {
    return <div className="text-slate-600">Loading contact...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{data.contact.name}</h1>
        <p className="text-sm text-slate-600 mt-1">{data.contact.email ?? '-'} · {data.contact.phone ?? '-'}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">LinkedIn Connection</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="text-sm text-slate-700">
            <span className="block mb-1">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {Array.from(new Set([...CONTACT_STATUS_OPTIONS, data.contact.status ?? 'Pending'])).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            <span className="block mb-1">LinkedIn Profile URL</span>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveContact}
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save LinkedIn Update'}
          </button>
          {linkedinUrl.trim() ? (
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:text-blue-600">
              Open profile
            </a>
          ) : null}
        </div>
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
