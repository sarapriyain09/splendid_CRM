'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lead } from '@/lib/types';

type AiTask = 'crm_qa' | 'lead_summary' | 'follow_up_email' | 'pipeline_insights';

interface AiResponse {
  output?: string;
  error?: string;
  model?: string;
}

const TASK_OPTIONS: Array<{ key: AiTask; label: string; help: string }> = [
  { key: 'crm_qa', label: 'CRM Q&A', help: 'Ask questions about follow-ups, priorities, and activity.' },
  { key: 'lead_summary', label: 'Lead Summary', help: 'Generate a concise briefing for one lead.' },
  { key: 'follow_up_email', label: 'Follow-up Email', help: 'Draft a personalized follow-up email.' },
  { key: 'pipeline_insights', label: 'Pipeline Insights', help: 'Analyze stalled deals and pipeline health.' },
];

export default function AiAssistantPage() {
  const [task, setTask] = useState<AiTask>('crm_qa');
  const [prompt, setPrompt] = useState('Which leads should I follow up with today, and why?');
  const [leadId, setLeadId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [model, setModel] = useState('');

  const requiresLead = task === 'lead_summary' || task === 'follow_up_email';

  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then((rows: Lead[]) => setLeads(Array.isArray(rows) ? rows.slice(0, 200) : []))
      .catch(() => setLeads([]));
  }, []);

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
    setResult('');
    setError('');
  }, [task]);

  const selectedTask = useMemo(() => TASK_OPTIONS.find(t => t.key === task), [task]);

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
      const idNum = Number(leadId);
      if (!idNum) {
        setError('Please select a lead for this task.');
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
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-sm text-slate-600 mt-1">
          CRM-aware assistant for lead follow-up, summaries, email drafting, and pipeline analysis.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-slate-700 font-medium block mb-1">Task</span>
            <select
              value={task}
              onChange={e => setTask(e.target.value as AiTask)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {TASK_OPTIONS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500 mt-1 block">{selectedTask?.help}</span>
          </label>

          {requiresLead ? (
            <label className="text-sm">
              <span className="text-slate-700 font-medium block mb-1">Lead</span>
              <select
                value={leadId}
                onChange={e => setLeadId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a lead</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.company_name} (#{lead.id})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 flex items-center">
              This task uses overall CRM data and does not require selecting a single lead.
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-slate-700 text-sm font-medium block mb-1">Prompt guidance</span>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Add constraints or desired output style"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={runAssistant}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Running...' : 'Run Assistant'}
          </button>
          {model && <span className="text-xs text-slate-500">Model: {model}</span>}
        </div>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Assistant output</div>
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-100 font-sans min-h-40">{result || 'Run the assistant to see output here.'}</pre>
      </div>
    </div>
  );
}
