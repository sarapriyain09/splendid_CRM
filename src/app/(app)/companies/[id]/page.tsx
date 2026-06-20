'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { INDUSTRY_OPTIONS } from '@/lib/industry-options';

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

function buildIndustryOptions(current: string): string[] {
  const set = new Set<string>(INDUSTRY_OPTIONS);
  const value = current.trim();
  if (value) set.add(value);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export default function CompanyDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
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

  // AI research assistant state.
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiWebSearch, setAiWebSearch] = useState(false);
  const [aiFields, setAiFields] = useState<{
    website?: string | null;
    industry?: string | null;
    country?: string | null;
    linkedin_url?: string | null;
    description?: string | null;
  } | null>(null);

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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string })?.error || 'Failed to update company');
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

  const industryOptions = useMemo(() => buildIndustryOptions(industry), [industry]);

  const deleteCompany = async () => {
    if (!id) return;
    if (!confirm(`Delete company "${data?.company?.name ?? ''}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/companies');
    } else {
      const payload = await res.json().catch(() => ({}));
      setError(payload?.error || 'Failed to delete company');
    }
  };

  const runResearch = async () => {
    if (!name.trim() && !aiQuestion.trim()) {
      setAiError('Enter a company name or a question first.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    setAiFields(null);
    try {
      const res = await fetch('/api/ai/company-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          country: country.trim() || undefined,
          question: aiQuestion.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Research failed.');
      }
      setAiAnswer(payload.answer ?? null);
      setAiFields(payload.fields ?? null);
      setAiWebSearch(Boolean(payload.usedWebSearch));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Research failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAllSuggestions = () => {
    if (!aiFields) return;
    if (aiFields.website) setWebsite(aiFields.website);
    if (aiFields.industry) setIndustry(aiFields.industry);
    if (aiFields.country) setCountry(aiFields.country);
    if (aiFields.linkedin_url) setLinkedinUrl(aiFields.linkedin_url);
  };

  const hasSuggestions = Boolean(
    aiFields && (aiFields.website || aiFields.industry || aiFields.country || aiFields.linkedin_url)
  );

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
        <p className="text-sm text-slate-600 mt-1">{industry || '-'} · {data.company.country ?? '-'}</p>
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
            {industryOptions.map((item) => (
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
          {isAdmin && (
            <button
              onClick={deleteCompany}
              className="inline-flex items-center rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50"
            >
              Delete Company
            </button>
          )}
          {success ? <span className="text-sm text-emerald-700">{success}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-indigo-900">AI Research Assistant</h2>
          <span className="text-[11px] text-indigo-500">Searches the web to fill in company details</span>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Ask anything about <span className="font-medium">{name || 'this company'}</span> — e.g. &quot;Find their website, LinkedIn and industry&quot; — and apply the results to the form above.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) runResearch(); }}
            placeholder="Ask anything (optional) — leave blank to auto-research this company"
            className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={runResearch}
            disabled={aiLoading}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
          >
            {aiLoading ? 'Researching...' : 'Research'}
          </button>
        </div>
        {aiError ? <div className="mt-2 text-sm text-red-600">{aiError}</div> : null}
        {aiAnswer ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-700">Answer</span>
              <span className="text-[11px] text-slate-400">{aiWebSearch ? 'Web search' : 'From general knowledge'}</span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{aiAnswer}</p>
            {aiFields?.description ? (
              <p className="text-xs text-slate-500 mt-2 italic">{aiFields.description}</p>
            ) : null}
          </div>
        ) : null}
        {hasSuggestions ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">Suggested values</span>
              <button
                onClick={applyAllSuggestions}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-600"
              >
                Apply all
              </button>
            </div>
            {([
              ['Website', aiFields?.website, () => aiFields?.website && setWebsite(aiFields.website!)],
              ['Industry', aiFields?.industry, () => aiFields?.industry && setIndustry(aiFields.industry!)],
              ['Country', aiFields?.country, () => aiFields?.country && setCountry(aiFields.country!)],
              ['LinkedIn', aiFields?.linkedin_url, () => aiFields?.linkedin_url && setLinkedinUrl(aiFields.linkedin_url!)],
            ] as Array<[string, string | null | undefined, () => void]>).map(([label, value, apply]) =>
              value ? (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-500">{label}:</span>{' '}
                    <span className="text-slate-800 break-all">{value}</span>
                  </div>
                  <button onClick={apply} className="text-xs text-indigo-700 hover:text-indigo-600 flex-shrink-0">Apply</button>
                </div>
              ) : null
            )}
            <p className="text-[11px] text-slate-400 pt-1">Review suggestions, then click Save Company to persist.</p>
          </div>
        ) : null}
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
          <div className="space-y-3">
            {rows.map((row: Record<string, unknown>, idx: number) => {
              if (active === 'contacts') {
                const contactName = toDisplayValue(row.name);
                const email = toDisplayValue(row.email);
                const phone = toDisplayValue(row.phone);
                const jobTitle = toDisplayValue(row.job_title);
                const createdAt = toDisplayValue(row.created_at);
                return (
                  <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                    <div className="font-semibold text-slate-900">{contactName}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-slate-700">
                      <div><span className="text-slate-500">Email:</span> {email}</div>
                      <div><span className="text-slate-500">Phone:</span> {phone}</div>
                      <div><span className="text-slate-500">Job Title:</span> {jobTitle}</div>
                      <div><span className="text-slate-500">Created:</span> {createdAt}</div>
                    </div>
                  </div>
                );
              }

              if (active === 'activities') {
                return (
                  <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                    <div className="font-semibold text-slate-900">{toDisplayValue(row.activity_type)}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-slate-700">
                      <div><span className="text-slate-500">Date:</span> {toDisplayValue(row.date)}</div>
                      <div><span className="text-slate-500">Contact:</span> {toDisplayValue(row.contact_name)}</div>
                      <div className="md:col-span-2"><span className="text-slate-500">Notes:</span> {toDisplayValue(row.notes)}</div>
                    </div>
                  </div>
                );
              }

              if (active === 'tasks') {
                return (
                  <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                    <div className="font-semibold text-slate-900">{toDisplayValue(row.title)}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-slate-700">
                      <div><span className="text-slate-500">Status:</span> {toDisplayValue(row.status)}</div>
                      <div><span className="text-slate-500">Priority:</span> {toDisplayValue(row.priority)}</div>
                      <div><span className="text-slate-500">Due Date:</span> {toDisplayValue(row.due_date)}</div>
                      <div><span className="text-slate-500">Done:</span> {toDisplayValue(row.done)}</div>
                      <div className="md:col-span-2"><span className="text-slate-500">Description:</span> {toDisplayValue(row.description)}</div>
                    </div>
                  </div>
                );
              }

              if (active === 'notes') {
                return (
                  <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                      <div><span className="text-slate-500">Created:</span> {toDisplayValue(row.created_at)}</div>
                      <div><span className="text-slate-500">User:</span> {toDisplayValue(row.user_name)}</div>
                      <div className="md:col-span-2"><span className="text-slate-500">Content:</span> {toDisplayValue(row.content)}</div>
                    </div>
                  </div>
                );
              }

              if (active === 'documents') {
                return (
                  <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                    <div className="font-semibold text-slate-900">{toDisplayValue(row.title)}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-slate-700">
                      <div><span className="text-slate-500">File Name:</span> {toDisplayValue(row.file_name)}</div>
                      <div><span className="text-slate-500">Type:</span> {toDisplayValue(row.file_type)}</div>
                      <div><span className="text-slate-500">Created:</span> {toDisplayValue(row.created_at)}</div>
                      <div><span className="text-slate-500">URL:</span> {toDisplayValue(row.file_url)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={String(row.id ?? idx)} className="border border-slate-200 rounded-lg p-3 bg-white text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>{' '}
                        <span className="text-slate-800">{toDisplayValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
