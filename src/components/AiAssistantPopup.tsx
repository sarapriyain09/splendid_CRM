'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Lead } from '@/lib/types';

type AiTask = 'crm_qa' | 'lead_summary' | 'follow_up_email' | 'pipeline_insights';
type PopupMode = 'assistant' | 'actions';
type ActionPage = 'prospects' | 'pipeline' | 'leads' | 'tasks';
type ActionScope = 'single' | 'selected' | 'all' | 'not_sent' | 'open' | 'done';
type ActionName =
  | 'send_email'
  | 'send_sms'
  | 'mark_contacted'
  | 'convert_to_lead'
  | 'move_vertical'
  | 'move_stage'
  | 'delete_leads'
  | 'mark_tasks_done'
  | 'mark_tasks_open'
  | 'delete_tasks';

interface AiResponse {
  output?: string;
  error?: string;
  model?: string;
}

const VERTICAL_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'engineering', label: 'Engineering Services' },
  { key: 'iot', label: 'Industry 4.0' },
  { key: 'ai_automation', label: 'Digital Twin AI' },
  { key: 'software', label: 'Software Platforms' },
];

const TASK_OPTIONS: Array<{ key: AiTask; label: string }> = [
  { key: 'crm_qa', label: 'CRM Q&A' },
  { key: 'lead_summary', label: 'Lead Summary' },
  { key: 'follow_up_email', label: 'Follow-up Email' },
  { key: 'pipeline_insights', label: 'Pipeline Insights' },
];

export default function AiAssistantPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PopupMode>('assistant');
  const [task, setTask] = useState<AiTask>('crm_qa');
  const [prompt, setPrompt] = useState('Which leads should I follow up with today, and why?');
  const [leadId, setLeadId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [model, setModel] = useState('');
  const [selectedProspects, setSelectedProspects] = useState<number[]>([]);
  const [actionPage, setActionPage] = useState<ActionPage>('prospects');
  const [actionName, setActionName] = useState<ActionName>('send_email');
  const [actionScope, setActionScope] = useState<ActionScope>('selected');
  const [actionValue, setActionValue] = useState('software');
  const [sendVertical, setSendVertical] = useState('all');
  const [templateVertical, setTemplateVertical] = useState('software');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [templateGuidance, setTemplateGuidance] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateStatus, setTemplateStatus] = useState('');

  const leadFromPath = useMemo(() => {
    const m = pathname?.match(/^\/leads\/(\d+)$/);
    return m ? m[1] : '';
  }, [pathname]);

  const taskFromPath = useMemo(() => {
    const m = pathname?.match(/^\/tasks\/(\d+)$/);
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

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ ids?: number[] }>;
      const ids = Array.isArray(custom.detail?.ids) ? custom.detail.ids : [];
      setSelectedProspects(ids.filter(n => Number.isFinite(n) && n > 0));
    };
    window.addEventListener('prospects-selection-changed', handler as EventListener);
    return () => window.removeEventListener('prospects-selection-changed', handler as EventListener);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/prospects')) {
      setActionPage('prospects');
      setActionName('send_email');
    } else if (pathname?.startsWith('/pipeline')) {
      setActionPage('pipeline');
      setActionName('move_stage');
      setActionValue('contacted');
    } else if (pathname?.startsWith('/tasks')) {
      setActionPage('tasks');
      setActionName('mark_tasks_done');
      setActionScope('open');
    } else if (pathname?.startsWith('/leads')) {
      setActionPage('leads');
      setActionName('move_stage');
      setActionScope('single');
      setActionValue('contacted');
    }
  }, [pathname]);

  useEffect(() => {
    if (actionPage === 'prospects') {
      setActionScope(selectedProspects.length > 0 ? 'selected' : 'all');
      if (!['send_email', 'send_sms', 'mark_contacted', 'convert_to_lead', 'move_vertical', 'delete_leads'].includes(actionName)) {
        setActionName('send_email');
      }
      return;
    }
    if (actionPage === 'pipeline' || actionPage === 'leads') {
      setActionScope(leadFromPath ? 'single' : 'all');
      if (!['mark_contacted', 'move_stage', 'move_vertical'].includes(actionName)) {
        setActionName('move_stage');
      }
      return;
    }
    if (actionPage === 'tasks') {
      setActionScope('open');
      if (!['mark_tasks_done', 'mark_tasks_open', 'delete_tasks'].includes(actionName)) {
        setActionName('mark_tasks_done');
      }
    }
  }, [actionPage, selectedProspects.length, leadFromPath, actionName]);

  async function loadTemplate(channel: 'email' | 'sms', vertical: string) {
    setTemplateBusy(true);
    setTemplateStatus('');
    try {
      const res = await fetch(`/api/outreach/templates?channel=${channel}&vertical=${vertical}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to load template.');
        return;
      }
      setTemplateSubject((data.template?.subject ?? '').toString());
      setTemplateMessage((data.template?.message ?? '').toString());
    } catch {
      setError('Failed to load template.');
    } finally {
      setTemplateBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== 'actions') return;
    if (actionPage !== 'prospects') return;
    if (actionName !== 'send_email' && actionName !== 'send_sms') return;
    loadTemplate(actionName === 'send_email' ? 'email' : 'sms', templateVertical);
  }, [mode, actionPage, actionName, templateVertical]);

  async function regenerateTemplate() {
    const channel = actionName === 'send_sms' ? 'sms' : 'email';
    if (!templateGuidance.trim()) {
      setError('Add user input before regenerating the template.');
      return;
    }

    setTemplateBusy(true);
    setTemplateStatus('');
    setError('');
    try {
      const res = await fetch('/api/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate',
          channel,
          vertical: templateVertical,
          userInput: templateGuidance,
          subject: channel === 'email' ? templateSubject : undefined,
          message: templateMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Regeneration failed.');
        return;
      }
      setTemplateSubject((data.template?.subject ?? '').toString());
      setTemplateMessage((data.template?.message ?? '').toString());
      setTemplateStatus('Template regenerated from your guidance.');
    } catch {
      setError('Regeneration failed.');
    } finally {
      setTemplateBusy(false);
    }
  }

  async function saveTemplate(action: 'save_vertical' | 'save_all_verticals') {
    const channel = actionName === 'send_sms' ? 'sms' : 'email';
    setTemplateBusy(true);
    setTemplateStatus('');
    setError('');
    try {
      const res = await fetch('/api/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          channel,
          vertical: templateVertical,
          subject: channel === 'email' ? templateSubject : undefined,
          message: templateMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Template save failed.');
        return;
      }
      setTemplateStatus(action === 'save_vertical' ? 'Saved for selected vertical.' : `Saved across all verticals (${data.updated ?? 0}).`);
    } catch {
      setError('Template save failed.');
    } finally {
      setTemplateBusy(false);
    }
  }

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

  async function runAction() {
    setLoading(true);
    setError('');
    setResult('');
    setModel('');

    try {
      if (actionName === 'send_email' || actionName === 'send_sms') {
        if (actionPage !== 'prospects') {
          setError('Email/SMS bulk outreach is available on Prospects actions.');
          setLoading(false);
          return;
        }
        const outreachScope = actionScope === 'not_sent' ? 'not_sent' : actionScope === 'all' ? 'all' : 'selected';
        const res = await fetch('/api/prospects/bulk-outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: actionName === 'send_email' ? 'email' : 'sms',
            scope: outreachScope,
            leadIds: outreachScope === 'selected' ? selectedProspects : undefined,
            vertical: sendVertical === 'all' ? undefined : sendVertical,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Action failed.');
        } else {
          setResult(`Outreach complete. Total: ${data.total ?? 0}, Sent: ${data.sent ?? 0}, Skipped: ${data.skipped ?? 0}, Failed: ${data.failed ?? 0}.`);
        }
        setLoading(false);
        return;
      }

      const ids = actionScope === 'selected' ? selectedProspects : undefined;
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: actionPage,
          action: actionName,
          scope: actionScope,
          ids,
          leadId: actionScope === 'single' && leadFromPath ? Number(leadFromPath) : undefined,
          taskId: actionScope === 'single' && taskFromPath ? Number(taskFromPath) : undefined,
          value: ['move_vertical', 'move_stage'].includes(actionName) ? actionValue : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Action failed.');
      } else {
        setResult(`Action completed: ${actionName}. Updated records: ${data.count ?? 0}.`);
      }
    } catch {
      setError('Action failed.');
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
            <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setMode('assistant')}
                className={`px-3 py-1.5 text-xs rounded ${mode === 'assistant' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Assistant
              </button>
              <button
                onClick={() => setMode('actions')}
                className={`px-3 py-1.5 text-xs rounded ${mode === 'actions' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Actions
              </button>
            </div>

            {mode === 'assistant' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-slate-400">Page</span>
                    <select value={actionPage} onChange={e => setActionPage(e.target.value as ActionPage)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                      <option value="prospects">Prospects</option>
                      <option value="pipeline">Pipeline</option>
                      <option value="leads">Leads</option>
                      <option value="tasks">Tasks</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Action</span>
                    <select value={actionName} onChange={e => setActionName(e.target.value as ActionName)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                      {actionPage === 'prospects' && (
                        <>
                          <option value="send_email">Send Email</option>
                          <option value="send_sms">Send SMS</option>
                          <option value="mark_contacted">Mark Contacted</option>
                          <option value="convert_to_lead">Convert to Lead</option>
                          <option value="move_vertical">Move Vertical</option>
                          <option value="delete_leads">Delete</option>
                        </>
                      )}
                      {(actionPage === 'pipeline' || actionPage === 'leads') && (
                        <>
                          <option value="move_stage">Move Stage</option>
                          <option value="move_vertical">Move Vertical</option>
                          <option value="mark_contacted">Mark Contacted</option>
                        </>
                      )}
                      {actionPage === 'tasks' && (
                        <>
                          <option value="mark_tasks_done">Mark Done</option>
                          <option value="mark_tasks_open">Mark Open</option>
                          <option value="delete_tasks">Delete</option>
                        </>
                      )}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-400">Scope</span>
                  <select value={actionScope} onChange={e => setActionScope(e.target.value as ActionScope)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                    {(actionPage === 'prospects' && (actionName === 'send_email' || actionName === 'send_sms')) ? (
                      <>
                        <option value="selected">Selected ({selectedProspects.length})</option>
                        <option value="all">All prospects</option>
                        <option value="not_sent">Not sent</option>
                      </>
                    ) : actionPage === 'tasks' ? (
                      <>
                        <option value="open">Open tasks</option>
                        <option value="done">Done tasks</option>
                        <option value="all">All tasks</option>
                      </>
                    ) : (
                      <>
                        <option value="single">Single (current page item)</option>
                        <option value="selected">Selected ({selectedProspects.length})</option>
                        <option value="all">All</option>
                      </>
                    )}
                  </select>
                </label>

                {actionName === 'move_vertical' && (
                  <label className="block">
                    <span className="text-xs text-slate-400">Vertical</span>
                    <select value={actionValue} onChange={e => setActionValue(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                      {VERTICAL_OPTIONS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                    </select>
                  </label>
                )}

                {actionName === 'move_stage' && (
                  <label className="block">
                    <span className="text-xs text-slate-400">Stage</span>
                    <select value={actionValue} onChange={e => setActionValue(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                      <option value="prospect">Prospect</option>
                      <option value="lead">Lead</option>
                      <option value="contacted">Contacted</option>
                      <option value="meeting_scheduled">Meeting Scheduled</option>
                      <option value="requirements">Requirements</option>
                      <option value="proposal_sent">Proposal Sent</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </label>
                )}

                {(actionPage === 'prospects' && (actionName === 'send_email' || actionName === 'send_sms')) && (
                  <div className="space-y-3 border border-slate-800 rounded-lg p-3 bg-slate-950/60">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-slate-400">Send Vertical Filter</span>
                        <select value={sendVertical} onChange={e => setSendVertical(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                          <option value="all">All verticals</option>
                          {VERTICAL_OPTIONS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Template Vertical</span>
                        <select value={templateVertical} onChange={e => setTemplateVertical(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                          {VERTICAL_OPTIONS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                        </select>
                      </label>
                    </div>

                    {actionName === 'send_email' && (
                      <label className="block">
                        <span className="text-xs text-slate-400">Email Subject Template</span>
                        <input value={templateSubject} onChange={e => setTemplateSubject(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                      </label>
                    )}

                    <label className="block">
                      <span className="text-xs text-slate-400">Message Template</span>
                      <textarea value={templateMessage} onChange={e => setTemplateMessage(e.target.value)} rows={6} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-400">Regenerate Guidance</span>
                      <textarea value={templateGuidance} onChange={e => setTemplateGuidance(e.target.value)} rows={2} placeholder="Example: Make it shorter, friendly, and focused on appointment booking." className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={regenerateTemplate} disabled={templateBusy} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded text-xs font-semibold">Regenerate</button>
                      <button onClick={() => saveTemplate('save_vertical')} disabled={templateBusy} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded text-xs font-semibold">Save Vertical</button>
                      <button onClick={() => saveTemplate('save_all_verticals')} disabled={templateBusy} className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded text-xs font-semibold">Save to All Verticals</button>
                      {templateStatus && <span className="text-[11px] text-emerald-300">{templateStatus}</span>}
                    </div>
                    <p className="text-[11px] text-slate-500">Templates support placeholders like {'{{company_name}}'}, {'{{location}}'}, {'{{sic_label}}'}, {'{{notes}}'}.</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={runAction} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white rounded-lg text-sm font-semibold">
                    {loading ? 'Running...' : 'Run Action'}
                  </button>
                  <span className="text-[11px] text-slate-500">AI can execute single and bulk actions from here.</span>
                </div>
              </>
            )}

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
