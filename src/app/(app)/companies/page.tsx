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

const DEFAULT_INDUSTRY_OPTIONS = [
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

export default function CompaniesPage() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCompanies = async () => {
    const url = query.trim() ? `/api/companies?search=${encodeURIComponent(query.trim())}` : '/api/companies';
    try {
      setLoadError(null);
      const response = await fetch(url);
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error((payload as { error?: string })?.error || 'Failed to load accounts');
      }
      setRows(Array.isArray(payload) ? payload : []);
      setLoadError(null);
    } catch (e) {
      // Keep the last successful rows instead of blanking the list on transient failures.
      setLoadError(e instanceof Error ? e.message : 'Failed to load accounts');
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [query]);

  useEffect(() => {
    if (rows.length > 0 || query.trim()) return;

    // Fallback fetch with no-store to avoid stale/intermittent cache issues.
    fetch('/api/companies', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (Array.isArray(payload) && payload.length > 0) {
          setRows(payload);
          setLoadError(null);
        }
      })
      .catch(() => {
        // Ignore fallback errors; primary loader already surfaces errors.
      });
  }, [rows.length, query]);

  const addCompany = async () => {
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to add company');
      }

      setName('');
      setIndustry('');
      setCountry('');
      setWebsite('');
      setLinkedinUrl('');
      loadCompanies();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add company');
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => rows.slice(0, 250), [rows]);
  const industryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_INDUSTRY_OPTIONS);
    rows.forEach((row) => {
      const value = (row.industry || '').trim();
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Add Company</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={addCompany}
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add Company'}
          </button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        {loadError ? <div className="px-4 py-3 text-sm text-red-600 border-b border-slate-200">{loadError}</div> : null}
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
