'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Lead, LeadStage } from '@/lib/types';
import { PIPELINE_STAGES, LEAD_SOURCES, LEAD_VERTICALS } from '@/lib/types';

const STAGE_COLORS: Record<string, string> = {
  prospect:'purple', lead:'slate', contacted:'blue', meeting_scheduled:'violet', requirements:'amber',
  proposal_sent:'orange', negotiation:'rose', won:'emerald', lost:'red',
};

function stageBadge(stage: LeadStage) {
  const color = STAGE_COLORS[stage] ?? 'slate';
  const label = PIPELINE_STAGES.find(s => s.key === stage)?.label ?? stage;
  const cls: Record<string, string> = {
    purple:'bg-purple-900 text-purple-300',
    slate:'bg-slate-800 text-slate-300', blue:'bg-blue-900 text-blue-300',
    violet:'bg-violet-900 text-violet-300', amber:'bg-amber-900 text-amber-300',
    orange:'bg-orange-900 text-orange-300', rose:'bg-rose-900 text-rose-300',
    emerald:'bg-emerald-900 text-emerald-300', red:'bg-red-900 text-red-300',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[color]}`}>{label}</span>;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [stage,  setStage]  = useState('');
  const [vertical, setVertical] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [users,  setUsers]  = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search)    p.set('search', search);
    if (stage)     p.set('stage', stage);
    if (vertical)  p.set('vertical', vertical);
    if (createdBy) p.set('assigned_to', createdBy);
    const data = await fetch(`/api/leads?${p}`).then(r => r.json());
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, stage, vertical, createdBy]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : []));
  }, []);

  async function importFromCH() {
    setImporting(true);
    try {
      // Fetch from the splendid-leads API
      const res = await fetch('http://localhost:3000/api/companies?sic_codes=43210,43220,49410,69201,70229,71121,71129&incorporated_from=' + new Date(Date.now()-90*864e5).toISOString().slice(0,10) + '&incorporated_to=' + new Date().toISOString().slice(0,10));
      const data = await res.json();
      const chLeads = data.leads ?? [];
      let added = 0;
      for (const l of chLeads.slice(0, 20)) {
        const c = l.company;
        const loc = [c.registered_office_address?.locality, c.registered_office_address?.postal_code?.split(' ')[0]].filter(Boolean).join(', ');
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name:   c.company_name,
            company_number: c.company_number,
            sic_code:       c.sic_codes?.[0] ?? null,
            source:         'companies_house',
            lead_score:     l.leadScore ?? 0,
            stage:          'lead',
            status:         'new',
            location:       loc || null,
            postcode:       c.registered_office_address?.postal_code ?? null,
            incorporated:   c.date_of_creation ?? null,
            website:        l.websiteUrl ?? null,
          }),
        });
        added++;
      }
      alert(`Imported ${added} leads from Companies House.`);
      fetchLeads();
    } catch {
      alert('Could not reach splendid-leads. Make sure it is running on port 3000.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Leads</h1>
          <p className="text-sm text-slate-500">{leads.length} records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={importFromCH} disabled={importing}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors">
            {importing ? 'Importing…' : '⬇ Import from CH'}
          </button>
          <Link href="/leads/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
            + Add Lead
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search company, location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
        />
        <select
          value={stage}
          onChange={e => setStage(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All stages</option>
          {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select
          value={vertical}
          onChange={e => setVertical(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All verticals</option>
          {LEAD_VERTICALS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
        {users.length > 0 && (
          <select
            value={createdBy}
            onChange={e => setCreatedBy(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">All users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-2">No leads yet.</p>
            <button onClick={importFromCH} disabled={importing} className="text-blue-400 hover:text-blue-300 text-sm">
              Import from Companies House →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="px-4 py-3 text-center w-14">Score</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Vertical</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Added</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ${
                      l.lead_score >= 70 ? 'bg-red-900 text-red-300' :
                      l.lead_score >= 50 ? 'bg-amber-900 text-amber-300' :
                      l.lead_score >= 30 ? 'bg-blue-900 text-blue-300' :
                      'bg-slate-800 text-slate-500'
                    }`}>{l.lead_score}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-slate-200 hover:text-white">
                      {l.company_name}
                    </Link>
                    {l.sic_label && <div className="text-xs text-slate-500">{l.sic_label}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{l.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const v = LEAD_VERTICALS.find(v => v.key === (l.vertical ?? 'general'));
                      const cls: Record<string,string> = {
                        amber:'bg-amber-900 text-amber-300',
                        fuchsia:'bg-fuchsia-900 text-fuchsia-300',
                        cyan:'bg-cyan-900 text-cyan-300', blue:'bg-blue-900 text-blue-300',
                        violet:'bg-violet-900 text-violet-300', emerald:'bg-emerald-900 text-emerald-300',
                        slate:'bg-slate-800 text-slate-400',
                      };
                      return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[v?.color ?? 'slate']}`}>{v?.label ?? 'General'}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{l.source.replace('_',' ')}</td>
                  <td className="px-4 py-3">{stageBadge(l.stage)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{l.created_at.slice(0,10)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="text-slate-500 hover:text-slate-300 text-lg">›</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
