'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PIPELINE_STAGES, LEAD_SOURCES, LEAD_VERTICALS } from '@/lib/types';

export default function NewLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', company_number: '', website: '', phone: '', email: '',
    location: '', postcode: '', incorporated: '', sic_code: '', sic_label: '',
    stage: 'lead', source: 'manual', lead_score: '0', status: 'active', vertical: 'crm',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, lead_score: Number(form.lead_score) }),
    });
    if (res.ok) {
      const lead = await res.json();
      router.push(`/leads/${lead.id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/leads" className="hover:text-slate-300">Leads</Link>
          <span>/</span>
          <span>New Lead</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Add Lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Company Name *</label>
          <input type="text" required value={form.company_name} onChange={e => set('company_name', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Companies House Number</label>
            <input type="text" value={form.company_number} onChange={e => set('company_number', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Incorporated Date</label>
            <input type="date" value={form.incorporated} onChange={e => set('incorporated', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Website</label>
            <input type="url" value={form.website} onChange={e => set('website', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Phone</label>
            <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Location</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Postcode</label>
            <input type="text" value={form.postcode} onChange={e => set('postcode', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">SIC Code</label>
            <input type="text" value={form.sic_code} onChange={e => set('sic_code', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Industry</label>
            <input type="text" value={form.sic_label} onChange={e => set('sic_label', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Vertical *</label>
            <select value={form.vertical} onChange={e => set('vertical', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
              {LEAD_VERTICALS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Stage</label>
            <select value={form.stage} onChange={e => set('stage', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Source</label>
            <select value={form.source} onChange={e => set('source', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
              {LEAD_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Lead Score (0–100)</label>
            <input type="number" min="0" max="100" value={form.lead_score} onChange={e => set('lead_score', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || !form.company_name.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Create Lead'}
          </button>
          <Link href="/leads" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
