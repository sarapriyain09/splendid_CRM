'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Channel = 'email' | 'sms';

interface TemplateRow {
  channel: Channel;
  vertical: string;
  subject: string | null;
  message: string;
  updated_at?: string;
}

const VERTICALS = [
  { key: 'crm', label: 'CRM' },
  { key: 'digital', label: 'Digital' },
  { key: 'software', label: 'Software' },
  { key: 'ai_automation', label: 'AI Automation' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'iot', label: 'IoT' },
];

export default function SettingsTemplatesPage() {
  const [channel, setChannel] = useState<Channel>('email');
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [guidance, setGuidance] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const rowMap = useMemo(() => {
    const map: Record<string, TemplateRow> = {};
    for (const r of rows) map[r.vertical] = r;
    return map;
  }, [rows]);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/outreach/templates?channel=${channel}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to load templates.');
        setLoading(false);
        return;
      }
      const templates = Array.isArray(data.templates) ? data.templates : [];
      setRows(templates as TemplateRow[]);
    } catch {
      setError('Failed to load templates.');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTemplates();
  }, [channel]);

  function updateRow(vertical: string, patch: Partial<TemplateRow>) {
    setRows(prev => prev.map(r => (r.vertical === vertical ? { ...r, ...patch } : r)));
  }

  async function saveVertical(vertical: string) {
    const row = rowMap[vertical];
    if (!row || !row.message.trim() || (channel === 'email' && !(row.subject ?? '').trim())) {
      setError('Please provide subject and message before saving.');
      return;
    }

    setSaving(prev => ({ ...prev, [vertical]: true }));
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_vertical',
          channel,
          vertical,
          subject: channel === 'email' ? row.subject : undefined,
          message: row.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save template.');
      } else {
        setSuccess(`Saved ${vertical} ${channel} template.`);
      }
    } catch {
      setError('Failed to save template.');
    }

    setSaving(prev => ({ ...prev, [vertical]: false }));
  }

  async function saveToAllFrom(vertical: string) {
    const row = rowMap[vertical];
    if (!row || !row.message.trim() || (channel === 'email' && !(row.subject ?? '').trim())) {
      setError('Please provide subject and message before applying to all.');
      return;
    }

    setSavingAll(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_all_verticals',
          channel,
          subject: channel === 'email' ? row.subject : undefined,
          message: row.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to update all verticals.');
      } else {
        setSuccess(`Applied to all verticals (${data.updated ?? 0}).`);
        await loadTemplates();
      }
    } catch {
      setError('Failed to update all verticals.');
    }

    setSavingAll(false);
  }

  async function regenerateVertical(vertical: string) {
    const row = rowMap[vertical];
    const userInput = (guidance[vertical] ?? '').trim();
    if (!row || !userInput) {
      setError('Add regenerate guidance first.');
      return;
    }

    setRegenerating(prev => ({ ...prev, [vertical]: true }));
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate',
          channel,
          vertical,
          userInput,
          subject: channel === 'email' ? row.subject : undefined,
          message: row.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to regenerate template.');
      } else {
        updateRow(vertical, {
          subject: channel === 'email' ? (data.template?.subject ?? row.subject ?? '') : null,
          message: data.template?.message ?? row.message,
        });
        setSuccess(`Regenerated ${vertical} ${channel} template. Review and save.`);
      }
    } catch {
      setError('Failed to regenerate template.');
    }

    setRegenerating(prev => ({ ...prev, [vertical]: false }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Outreach Templates</h1>
          <p className="text-sm text-slate-500">Manage unique templates by vertical for Email and SMS.</p>
        </div>
        <Link href="/settings" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg">Back to Settings</Link>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setChannel('email')} className={`px-3 py-1.5 text-sm rounded-lg ${channel === 'email' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
          Email Templates
        </button>
        <button onClick={() => setChannel('sms')} className={`px-3 py-1.5 text-sm rounded-lg ${channel === 'sms' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
          SMS Templates
        </button>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-950/40 border border-red-800 rounded-lg p-2">{error}</div>}
      {success && <div className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-lg p-2">{success}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {loading ? (
          <div className="px-4 py-8 text-sm text-slate-500">Loading templates...</div>
        ) : (
          VERTICALS.map(v => {
            const row = rowMap[v.key] ?? { channel, vertical: v.key, subject: '', message: '' };
            return (
              <div key={v.key} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-sm font-semibold text-slate-200">{v.label}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => regenerateVertical(v.key)}
                      disabled={!!regenerating[v.key] || !!saving[v.key] || savingAll}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 text-white text-xs rounded"
                    >
                      {regenerating[v.key] ? 'Regenerating...' : 'Regenerate with AI'}
                    </button>
                    <button
                      onClick={() => saveVertical(v.key)}
                      disabled={!!saving[v.key] || !!regenerating[v.key] || savingAll}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs rounded"
                    >
                      {saving[v.key] ? 'Saving...' : 'Save Vertical'}
                    </button>
                    <button
                      onClick={() => saveToAllFrom(v.key)}
                      disabled={savingAll || !!saving[v.key] || !!regenerating[v.key]}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 text-white text-xs rounded"
                    >
                      {savingAll ? 'Applying...' : 'Use for All Verticals'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Regenerate Guidance</label>
                  <textarea
                    value={guidance[v.key] ?? ''}
                    onChange={e => setGuidance(prev => ({ ...prev, [v.key]: e.target.value }))}
                    rows={2}
                    placeholder="Example: Make it shorter, friendlier, and focused on booking a 15-minute call."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>

                {channel === 'email' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Subject</label>
                    <input
                      value={row.subject ?? ''}
                      onChange={e => updateRow(v.key, { subject: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Message</label>
                  <textarea
                    value={row.message}
                    onChange={e => updateRow(v.key, { message: e.target.value })}
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-slate-500">Supported placeholders: {'{{company_name}}'}, {'{{location}}'}, {'{{sic_label}}'}, {'{{notes}}'}.</p>
    </div>
  );
}
