'use client';
import { useState, useCallback } from 'react';
import type { Lead, Officer, WebsiteStatus } from '@/lib/types-ch';
import { SIC_TIERS, SIC_DESCRIPTIONS, ALL_TRACKED_SIC_CODES, getSicTier } from '@/lib/sic-codes';

// ─── Constants ─────────────────────────────────────────────────────────────
const LOCATIONS = ['Leicester', 'Birmingham', 'Coventry', 'Derby', 'Nottingham', 'Wolverhampton'];

const TIER_GROUPS = [
  { label: 'Tier 1 – High Priority', codes: [...SIC_TIERS.tier1], color: 'text-red-400'  },
  { label: 'Tier 2 – Medium',        codes: [...SIC_TIERS.tier2], color: 'text-amber-400' },
  { label: 'Tier 3 – Low / Partner', codes: [...SIC_TIERS.tier3], color: 'text-slate-400' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatLocation(company: Lead['company']): string {
  const a = company.registered_office_address;
  return [a.locality, a.postal_code?.split(' ')[0]].filter(Boolean).join(', ') || '—';
}

function scoreColor(score: number) {
  if (score >= 70) return 'bg-red-900 text-red-200';
  if (score >= 50) return 'bg-amber-900 text-amber-200';
  if (score >= 30) return 'bg-blue-900 text-blue-200';
  return 'bg-slate-800 text-slate-400';
}

function websiteBadge(status: WebsiteStatus, url?: string) {
  const base = 'text-xs px-2 py-0.5 rounded font-medium';
  if (status === 'checking') return <span className={`${base} bg-slate-700 text-slate-400 animate-pulse`}>Checking…</span>;
  if (status === 'not_found') return <span className={`${base} bg-emerald-900 text-emerald-300`}>No site ✓</span>;
  if (status === 'construction') return <span className={`${base} bg-amber-900 text-amber-300`}>Under construction</span>;
  if (status === 'found' && url) return <a href={url} target="_blank" rel="noreferrer" className={`${base} bg-slate-700 text-blue-400 hover:text-blue-300`}>Has site →</a>;
  return <span className={`${base} bg-slate-800 text-slate-500`}>Unchecked</span>;
}

// ─── Sub-components ────────────────────────────────────────────────────────
function OfficersCell({ companyNumber }: { companyNumber: string }) {
  const [officers, setOfficers] = useState<Officer[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (officers !== null) return;
    setLoading(true);
    const res = await fetch(`/api/ch/officers?company_number=${companyNumber}`);
    if (res.ok) { const d = await res.json(); setOfficers(d.items ?? []); }
    setLoading(false);
  }

  if (!officers) return (
    <button onClick={load} disabled={loading}
      className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
      {loading ? 'Loading…' : 'Show directors'}
    </button>
  );

  return (
    <div className="space-y-0.5">
      {officers.slice(0, 3).map((o, i) => (
        <div key={i} className="text-xs text-slate-300">
          <span className="font-medium">{o.name}</span>
          <span className="text-slate-500 ml-1">({o.officer_role})</span>
        </div>
      ))}
      {officers.length === 0 && <span className="text-xs text-slate-600">No active directors</span>}
    </div>
  );
}

function EmailCell({ websiteUrl, companyName }: { websiteUrl?: string; companyName: string }) {
  const [emails, setEmails] = useState<{ address: string; confidence: string }[] | null>(null);

  async function load() {
    if (emails !== null) return;
    const p = new URLSearchParams();
    if (websiteUrl) p.set('website_url', websiteUrl); else p.set('company_name', companyName);
    const res = await fetch(`/api/ch/guess-email?${p}`);
    if (res.ok) { const d = await res.json(); setEmails(d.emails ?? []); }
  }

  if (!emails) return (
    <button onClick={load} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
      Guess emails
    </button>
  );

  return (
    <div className="space-y-0.5">
      {emails.slice(0, 3).map((e, i) => (
        <div key={i} className="text-xs">
          <a href={`mailto:${e.address}`} className="text-blue-400 hover:text-blue-300">{e.address}</a>
          <span className={`ml-1 text-[10px] ${e.confidence === 'high' ? 'text-emerald-500' : e.confidence === 'medium' ? 'text-amber-500' : 'text-slate-600'}`}>
            {e.confidence}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Push-to-CRM button ────────────────────────────────────────────────────
function PushButton({ lead }: { lead: Lead }) {
  const [state, setState] = useState<'idle'|'pushing'|'done'|'exists'>('idle');

  async function push() {
    setState('pushing');
    const c = lead.company;
    const loc = formatLocation(c);
    const body = {
      company_name:   c.company_name,
      company_number: c.company_number,
      sic_code:       c.sic_codes?.[0] ?? null,
      sic_label:      SIC_DESCRIPTIONS[c.sic_codes?.[0] ?? ''] ?? null,
      source:         'companies_house',
      lead_score:     lead.leadScore,
      stage:          'lead',
      status:         'active',
      location:       loc !== '—' ? loc : null,
      postcode:       c.registered_office_address?.postal_code ?? null,
      incorporated:   c.date_of_creation ?? null,
      website:        lead.websiteUrl ?? null,
    };

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 409) { setState('exists'); return; }
    setState(res.ok ? 'done' : 'idle');
  }

  if (state === 'done')   return <span className="text-xs text-emerald-400 font-medium">✓ Added to CRM</span>;
  if (state === 'exists') return <span className="text-xs text-amber-400 font-medium">Already in CRM</span>;

  return (
    <button onClick={push} disabled={state === 'pushing'}
      className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
      {state === 'pushing' ? 'Saving…' : '+ Push to CRM'}
    </button>
  );
}

// ─── Row component ─────────────────────────────────────────────────────────
function LeadRow({ lead, onCheck }: { lead: Lead; onCheck: () => void }) {
  const { company, websiteStatus, websiteUrl, leadScore } = lead;
  const sicCode = company.sic_codes?.[0];
  const tier = sicCode ? getSicTier(sicCode) : null;

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
      <td className="px-3 py-3 text-center">
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${scoreColor(leadScore)}`}>
          {leadScore}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-slate-100 leading-snug text-sm">{company.company_name}</div>
        <div className="text-xs text-slate-500 font-mono">{company.company_number}</div>
        {company.date_of_creation && (
          <div className="text-xs text-slate-600">Est. {company.date_of_creation.slice(0, 7)}</div>
        )}
      </td>
      <td className="px-3 py-3">
        {sicCode && (
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-1 rounded ${
              tier === 1 ? 'bg-red-900 text-red-300' :
              tier === 2 ? 'bg-amber-900 text-amber-300' :
              'bg-slate-700 text-slate-400'
            }`}>T{tier ?? '?'}</span>
            <span className="text-xs text-slate-400 font-mono">{sicCode}</span>
          </div>
        )}
        {sicCode && <div className="text-xs text-slate-500 mt-0.5">{SIC_DESCRIPTIONS[sicCode] ?? ''}</div>}
      </td>
      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatLocation(company)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1 items-start">
          {websiteBadge(websiteStatus, websiteUrl)}
          {websiteStatus === 'unknown' && (
            <button onClick={onCheck} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
              Check site
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3"><OfficersCell companyNumber={company.company_number} /></td>
      <td className="px-3 py-3"><EmailCell websiteUrl={websiteUrl} companyName={company.company_name} /></td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1 items-start">
          <PushButton lead={lead} />
          <a href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
            target="_blank" rel="noreferrer"
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            View on CH →
          </a>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function LeadGeneratorPage() {
  const [mode, setMode] = useState<'new'|'existing'>('new');

  // New companies filters
  const [incorporatedFrom, setIncorporatedFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10);
  });
  const [incorporatedTo, setIncorporatedTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Existing companies filters
  const [selectedLocations, setSelectedLocations] = useState<string[]>(['Leicester', 'Birmingham']);

  // Shared filters
  const [selectedSic, setSelectedSic] = useState<string[]>([...SIC_TIERS.tier1]);

  // Results
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAll, setCheckingAll] = useState(false);

  function toggleSic(code: string) {
    setSelectedSic(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  }
  function toggleLocation(loc: string) {
    setSelectedLocations(p => p.includes(loc) ? p.filter(l => l !== loc) : [...p, loc]);
  }
  function selectTier(codes: string[]) {
    setSelectedSic(p => {
      const all = codes.every(c => p.includes(c));
      return all ? p.filter(c => !codes.includes(c)) : [...new Set([...p, ...codes])];
    });
  }

  const search = useCallback(async () => {
    if (selectedSic.length === 0) return;
    setLoading(true); setError(''); setLeads([]);

    const p = new URLSearchParams({ sic_codes: selectedSic.join(',') });
    let url: string;
    if (mode === 'new') {
      p.set('incorporated_from', incorporatedFrom);
      p.set('incorporated_to', incorporatedTo);
      url = `/api/ch/new-companies?${p}`;
    } else {
      if (selectedLocations.length === 0) { setError('Select at least one location.'); setLoading(false); return; }
      p.set('locations', selectedLocations.join(','));
      url = `/api/ch/existing-companies?${p}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setError(data.error); } else { setLeads(data.leads ?? []); setTotalHits(data.hits ?? 0); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to fetch'); }
    setLoading(false);
  }, [mode, selectedSic, incorporatedFrom, incorporatedTo, selectedLocations]);

  const checkWebsiteForLead = useCallback(async (lead: Lead) => {
    const idx = leads.findIndex(l => l.company.company_number === lead.company.company_number);
    if (idx === -1) return;
    const updated = [...leads];
    updated[idx] = { ...updated[idx], websiteStatus: 'checking' };
    setLeads(updated);
    try {
      const res = await fetch(`/api/ch/check-website?company_name=${encodeURIComponent(lead.company.company_name)}`);
      const data = await res.json();
      updated[idx] = { ...updated[idx], websiteStatus: data.status, websiteUrl: data.url };
    } catch {
      updated[idx] = { ...updated[idx], websiteStatus: 'unknown' };
    }
    setLeads([...updated]);
  }, [leads]);

  const checkAllWebsites = useCallback(async () => {
    setCheckingAll(true);
    for (const lead of leads) {
      if (lead.websiteStatus === 'unknown') {
        await checkWebsiteForLead(lead);
        await new Promise(r => setTimeout(r, 300));
      }
    }
    setCheckingAll(false);
  }, [leads, checkWebsiteForLead]);

  async function pushAll() {
    let count = 0;
    for (const lead of leads) {
      const c = lead.company;
      const loc = formatLocation(c);
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: c.company_name, company_number: c.company_number,
          sic_code: c.sic_codes?.[0] ?? null,
          sic_label: SIC_DESCRIPTIONS[c.sic_codes?.[0] ?? ''] ?? null,
          source: 'companies_house', lead_score: lead.leadScore,
          stage: 'lead', status: 'active',
          location: loc !== '—' ? loc : null,
          postcode: c.registered_office_address?.postal_code ?? null,
          incorporated: c.date_of_creation ?? null,
          website: lead.websiteUrl ?? null,
        }),
      });
      count++;
    }
    alert(`Pushed ${count} leads to CRM.`);
  }

  const unchecked = leads.filter(l => l.websiteStatus === 'unknown').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Lead Generator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Find companies via Companies House and push them to the CRM</p>
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['new','existing'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setLeads([]); }}
              className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {m === 'new' ? 'New Companies' : 'Existing Companies'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {/* SIC codes */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SIC Codes</div>
          {TIER_GROUPS.map(g => (
            <div key={g.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <button onClick={() => selectTier(g.codes)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                  {g.codes.every(c => selectedSic.includes(c)) ? '☑' : '☐'} Toggle all
                </button>
                <span className={`text-[11px] font-semibold ${g.color}`}>{g.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.codes.map(code => (
                  <button key={code} onClick={() => toggleSic(code)}
                    className={`text-xs px-2 py-1 rounded transition-colors font-mono ${
                      selectedSic.includes(code)
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    }`} title={SIC_DESCRIPTIONS[code]}>
                    {code}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mode-specific filters */}
        {mode === 'new' ? (
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Incorporated From</label>
              <input type="date" value={incorporatedFrom} onChange={e => setIncorporatedFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Incorporated To</label>
              <input type="date" value={incorporatedTo} onChange={e => setIncorporatedTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Locations</div>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map(loc => (
                <button key={loc} onClick={() => toggleLocation(loc)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    selectedLocations.includes(loc)
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  }`}>
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={search} disabled={loading || selectedSic.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors">
            {loading ? 'Searching…' : 'Search Companies House'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Results */}
      {leads.length > 0 && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-slate-400">
              <span className="text-slate-100 font-semibold">{leads.length}</span> results
              {totalHits > leads.length && <span className="text-slate-600"> of {totalHits.toLocaleString()} total</span>}
            </span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={checkAllWebsites} disabled={checkingAll || unchecked === 0}
                className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors">
                {checkingAll ? 'Checking websites…' : `Check All Websites (${unchecked})`}
              </button>
              <button onClick={pushAll}
                className="text-xs px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
                Push All to CRM ({leads.length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-center w-14">Score</th>
                    <th className="px-3 py-3 text-left">Company</th>
                    <th className="px-3 py-3 text-left">SIC</th>
                    <th className="px-3 py-3 text-left">Location</th>
                    <th className="px-3 py-3 text-left">Website</th>
                    <th className="px-3 py-3 text-left">Directors</th>
                    <th className="px-3 py-3 text-left">Emails</th>
                    <th className="px-3 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <LeadRow
                      key={lead.company.company_number}
                      lead={lead}
                      onCheck={() => checkWebsiteForLead(lead)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && leads.length === 0 && !error && (
        <div className="text-center py-20 text-slate-600">
          Select SIC codes{mode === 'existing' ? ' and locations' : ' and a date range'}, then click Search.
        </div>
      )}
    </div>
  );
}
