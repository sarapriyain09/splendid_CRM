'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lead } from '@/lib/types';
import { PIPELINE_STAGES } from '@/lib/types';

interface Stats {
  totalLeads: number; hotLeads: number; wonDeals: number;
  openQuotes: number; quoteValue: number;
  recentLeads: Lead[];
  stageCount: { stage: string; c: number }[];
}

// Funnel stages in order (excluding 'lost' from the main funnel)
const FUNNEL_STAGES = [
  { key: 'prospect',          label: 'Prospects',         color: 'bg-violet-600' },
  { key: 'lead',              label: 'Leads',             color: 'bg-blue-600' },
  { key: 'contacted',         label: 'Contacted',         color: 'bg-cyan-600' },
  { key: 'meeting_scheduled', label: 'Meeting Booked',    color: 'bg-teal-600' },
  { key: 'requirements',      label: 'Requirements',      color: 'bg-emerald-600' },
  { key: 'proposal_sent',     label: 'Proposal Sent',     color: 'bg-yellow-600' },
  { key: 'negotiation',       label: 'Negotiation',       color: 'bg-orange-600' },
  { key: 'won',               label: 'Won',               color: 'bg-green-500' },
];

const STAT_CARDS = (s: Stats) => [
  { label: 'Total Leads',    value: s.totalLeads,                        color: 'text-blue-400',    icon: '◎' },
  { label: 'Hot Leads',      value: s.hotLeads,                          color: 'text-red-400',     icon: '🔴' },
  { label: 'Deals Won',      value: s.wonDeals,                          color: 'text-emerald-400', icon: '✓' },
  { label: 'Pipeline Value', value: `£${s.quoteValue.toLocaleString()}`, color: 'text-amber-400',   icon: '◻' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
  }, []);

  if (!stats) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-slate-800 rounded w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
      </div>
    </div>
  );

  const stageMap = Object.fromEntries(stats.stageCount.map(s => [s.stage, s.c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
        <Link href="/leads/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Add Lead
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS(stats).map(c => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Sales Funnel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-300">Sales Funnel</h2>
          <span className="text-xs text-slate-500">{stats.stageCount.reduce((a, s) => a + s.c, 0)} total</span>
        </div>
        <div className="space-y-1.5">
          {(() => {
            const sm = Object.fromEntries(stats.stageCount.map(s => [s.stage, s.c]));
            const top = Math.max(...FUNNEL_STAGES.map(s => sm[s.key] ?? 0), 1);
            return FUNNEL_STAGES.map((stage, i) => {
              const count = sm[stage.key] ?? 0;
              const pct   = Math.round((count / top) * 100);
              const prev  = i > 0 ? (sm[FUNNEL_STAGES[i - 1].key] ?? 0) : null;
              const conv  = prev !== null && prev > 0 ? Math.round((count / prev) * 100) : null;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-slate-400 text-right truncate">{stage.label}</div>
                  <div className="flex-1 flex justify-center">
                    <div
                      className={`${stage.color} rounded h-7 flex items-center justify-center transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    >
                      {count > 0 && <span className="text-xs font-semibold text-white px-2">{count}</span>}
                    </div>
                  </div>
                  <div className="w-14 text-xs text-slate-500 text-left">
                    {conv !== null ? <span className={conv >= 50 ? 'text-emerald-400' : conv >= 25 ? 'text-amber-400' : 'text-red-400'}>{conv}%</span> : <span className="text-slate-600">—</span>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          <span>Bar width = relative volume</span>
          <span>% = conversion from previous stage</span>
          <Link href="/pipeline" className="ml-auto text-blue-400 hover:text-blue-300">View Pipeline →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline snapshot */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Pipeline Snapshot</h2>
          <div className="space-y-2">
            {PIPELINE_STAGES.filter(s => !['lead'].includes(s.key)).map(s => {
              const count = stageMap[s.key] ?? 0;
              const max   = Math.max(...Object.values(stageMap), 1);
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-slate-400 truncate">{s.label}</div>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                  <div className="w-6 text-xs text-slate-400 text-right">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent leads */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Recent Leads</h2>
            <Link href="/leads" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
          </div>
          <div className="space-y-2">
            {stats.recentLeads.length === 0 && (
              <p className="text-xs text-slate-600 py-4 text-center">No leads yet. <Link href="/leads" className="text-blue-400">Import from Companies House</Link></p>
            )}
            {stats.recentLeads.map((l) => (
              <Link key={l.id} href={`/leads/${l.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  l.lead_score >= 70 ? 'bg-red-900 text-red-300' :
                  l.lead_score >= 50 ? 'bg-amber-900 text-amber-300' :
                  'bg-slate-800 text-slate-400'
                }`}>{l.lead_score}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate group-hover:text-white">{l.company_name}</div>
                  <div className="text-xs text-slate-500">{l.location ?? '—'} · {l.source.replace('_',' ')}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
