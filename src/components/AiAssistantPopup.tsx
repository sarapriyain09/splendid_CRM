'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Lead } from '@/lib/types';

type AiTask = 'crm_qa' | 'lead_summary' | 'follow_up_email' | 'pipeline_insights';

interface AiResponse {
  output?: string;
  error?: string;
  model?: string;
}

const TASK_OPTIONS: Array<{ key: AiTask; label: string }> = [
  { key: 'crm_qa', label: 'CRM Q&A' },
  { key: 'lead_summary', label: 'Lead Summary' },
  { key: 'follow_up_email', label: 'Follow-up Email' },
  { key: 'pipeline_insights', label: 'Pipeline Insights' },
];

export default function AiAssistantPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<AiTask>('crm_qa');
  const [prompt, setPrompt] = useState('Which leads should I follow up with today, and why?');
  const [leadId, setLeadId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [model, setModel] = useState('');

  const leadFromPath = useMemo(() => {
    const m = pathname?.match(/^\/leads\/(\d+)$/);
    return m ? m[1] : '';
  }, [pathname]);

  const requiresLead = task === 'lead_summary' || task === 'follow_up_email';
  const effectiveLeadId = leadFromPath || leadId;

  useEffect(() => {
    if (task === 'lead_summary') {
      setPrompt('Create a concise call prep summary and best next actions.');
    } else if (task === 'follow_up_email') {
      setPrompt('Keep it friendly, direct, and ask for a 15-minute call next week.');
    } else if (task === 'pipeline_insights') {
      setPrompt('Focus on stalled deals and forecast risk for this month.');
    } else {
      setPrompt('Which leads should I follow up with today, and why?');
    }
    setError('');
    setResult('');
  }, [task]);

  useEffect(() => {
    if (!open || !requiresLead || leadFromPath || leads.length > 0 || loadingLeads) return;
    setLoadingLeads(true);
    fetch('/api/leads')
      .then(r => r.json())
      .then((rows: Lead[]) => setLeads(Array.isArray(rows) ? rows.slice(0, 200) : []))
      .catch(() => setLeads([]))
      .finally(() => setLoadingLeads(false));
  }, [open, requiresLead, leadFromPath, leads.length, loadingLeads]);

  async function runAssistant() {
    setLoading(true);
    setError('');
    setResult('');
    setModel('');

    const payload: { task: AiTask; prompt?: string; leadId?: number } = {
      task,
      prompt: prompt.trim(),
    };

    if (requiresLead) {
      const idNum = Number(effectiveLeadId);
      if (!idNum) {
        setError('Select a lead or open a lead page first.');
        setLoading(false);
        return;
      }
      payload.leadId = idNum;
    }

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as AiResponse;
      if (!res.ok) {
        setError(data.error ?? 'Assistant request failed.');
        setLoading(false);
        return;
      }

      setResult(data.output ?? 'No response from assistant.');
      setModel(data.model ?? '');
    } catch {
      setError('Assistant request failed.');
    }

    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 text-sm font-semibold shadow-lg"
      >
        AI Assistant
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[min(96vw,520px)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">AI Assistant Actions</h2>
              <p className="text-[11px] text-slate-400">Run CRM-aware actions from any page.</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setTask('crm_qa'); setPrompt('Which leads should I follow up with today, and why?'); }} className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white">Today follow-ups</button>
              <button onClick={() => { setTask('pipeline_insights'); setPrompt('Focus on stalled deals and forecast risk for this month.'); }} className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white">Pipeline risks</button>
              <button onClick={() => { setTask('follow_up_email'); setPrompt('Draft a concise email and ask for a 15-minute call.'); }} className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white">Draft follow-up email</button>
            </div>

            <label className="block">
              <span className="text-xs text-slate-400">Task</span>
              <select
                value={task}
                onChange={e => setTask(e.target.value as AiTask)}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                {TASK_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            {requiresLead && (
              <label className="block">
                <span className="text-xs text-slate-400">Lead</span>
                {leadFromPath ? (
                  <div className="mt-1 text-xs rounded-lg border border-blue-800 bg-blue-950/40 text-blue-300 px-3 py-2">
                    Using current page lead #{leadFromPath}
                  </div>
                ) : (
                  <select
                    value={leadId}
                    onChange={e => setLeadId(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">{loadingLeads ? 'Loading leads...' : 'Select a lead'}</option>
                    {leads.map(lead => (
                      <option key={lead.id} value={lead.id}>{lead.company_name} (#{lead.id})</option>
                    ))}
                  </select>
                )}
              </label>
            )}

            <label className="block">
              <span className="text-xs text-slate-400">Prompt guidance</span>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                onClick={runAssistant}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold"
              >
                {loading ? 'Running...' : 'Run'}
              </button>
              <Link href="/ai-assistant" className="text-xs text-blue-400 hover:text-blue-300">Open full assistant</Link>
              {model && <span className="text-[11px] text-slate-500">Model: {model}</span>}
            </div>

            {error && <div className="text-xs text-red-300 bg-red-950/40 border border-red-800 rounded-lg p-2">{error}</div>}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 max-h-56 overflow-auto">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Output</div>
              <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-200 font-sans">{result || 'Run an action to see output.'}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
