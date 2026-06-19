'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type TabKey =
  | 'contacts'
  | 'activities'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'opportunities'
  | 'quotes'
  | 'campaignHistory'
  | 'callHistory';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'activities', label: 'Activities' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'documents', label: 'Documents' },
  { key: 'opportunities', label: 'Opportunities (Read-only)' },
  { key: 'quotes', label: 'Quotes (Read-only)' },
  { key: 'campaignHistory', label: 'Campaign History (Read-only)' },
  { key: 'callHistory', label: 'Call History (Read-only)' },
];

const INDUSTRY_OPTIONS = [
  'Engineering',
  'Manufacturing',
  'Information Technology',
  'Construction',
  'Retail',
  'Healthcare',
  'Finance',
  'Education',
  'Logistics',
  'Other',
] as const;

const COUNTRY_OPTIONS = [
  'United Kingdom',
  'United States',
  'India',
  'United Arab Emirates',
  'Germany',
  'France',
  'Netherlands',
  'Canada',
  'Australia',
  'Other',
] as const;

export default function CompanyDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [active, setActive] = useState<TabKey>('contacts');
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [status, setStatus] = useState('Prospect');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setPageError('Missing account id in route.');
      return;
    }

    setPageError(null);
    fetch(`/api/companies/${id}`)
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error((payload as { error?: string })?.error || 'Failed to load account');
        }
        return payload;
      })
      .then((payload) => {
        setData(payload);
        setName(payload?.company?.name ?? '');
        setIndustry(payload?.company?.industry ?? '');
        setCountry(payload?.company?.country ?? '');
        setWebsite(payload?.company?.website ?? '');
        setLinkedinUrl(payload?.company?.linkedin_url ?? '');
        setStatus(payload?.company?.status ?? 'Prospect');
      })
      .catch((e) => {
        setPageError(e instanceof Error ? e.message : 'Failed to load account');
      });
  }, [id]);

  const saveCompany = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!id) throw new Error('Missing account id in route.');

      const response = await fetch(`/api/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          industry: industry.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          status,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update company');
      }

      setData((prev: any) => ({ ...prev, company: payload }));
      setSuccess('Company updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    if (!data?.tabs) return [];
    return Array.isArray(data.tabs[active]) ? data.tabs[active] : [];
  }, [data, active]);

  if (pageError) {
    return <div className="text-red-600">{pageError}</div>;
  }

  if (!data?.company) {
    return <div className="text-slate-600">Loading account...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{data.company.name}</h1>
        <p className="text-sm text-slate-600 mt-1">{data.company.industry ?? '-'} · {data.company.country ?? '-'}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Company Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select country</option>
            {COUNTRY_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Website"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="LinkedIn URL"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="Status"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveCompany}
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Company'}
          </button>
          {success ? <span className="text-sm text-emerald-700">{success}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
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
