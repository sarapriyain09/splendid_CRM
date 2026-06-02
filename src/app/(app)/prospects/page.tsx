'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Lead } from '@/lib/types';

function scoreColor(score: number) {
  if (score >= 70) return 'bg-red-900 text-red-200';
  if (score >= 50) return 'bg-amber-900 text-amber-200';
  if (score >= 30) return 'bg-blue-900 text-blue-200';
  return 'bg-slate-800 text-slate-400';
}

function buildSMS(prospect: Lead): string {
  const name    = prospect.company_name;
  const reasons = (prospect.notes ?? '').split(' · ').filter(Boolean);
  const hasNoWebsite = reasons.some(r => r.toLowerCase().includes('no website'));
  if (hasNoWebsite) {
    return `Hi ${name}, I'm from Splendid Technology. We build professional websites from £499 to help you get found online. Free 15min chat? splendidtechnology.co.uk`;
  }
  return `Hi ${name}, I spotted a few issues with your website that could be costing you customers. Free 15min chat to fix them? Splendid Technology - splendidtechnology.co.uk`;
}

// ─── SMS compose modal ───────────────────────────────────────────────────────
function SmsPanel({ prospect, onClose, onSent }: {
  prospect: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to,      setTo]      = useState(prospect.phone ?? '');
  const [message, setMessage] = useState(buildSMS(prospect));
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const charsLeft = 160 - message.length;

  async function send() {
    if (!to.trim() || !message.trim()) return;
    setSending(true); setError('');
    const res = await fetch('/api/prospects/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: prospect.id, to, message }),
    });
    const data = await res.json();
    if (res.status === 503 && data.error === 'not_configured') {
      setNotConfigured(true); setSending(false); return;
    }
    if (!res.ok) { setError(data.error ?? 'Failed to send'); setSending(false); return; }
    setSent(true);
    setTimeout(() => { onSent(); onClose(); }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100">Send SMS</h2>
            <p className="text-xs text-slate-500">{prospect.company_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {notConfigured && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 space-y-2">
              <div className="text-amber-300 font-semibold text-sm">⚠ Twilio Not Configured</div>
              <p className="text-xs text-slate-400">Add these to <span className="font-mono text-slate-300">.env.local</span> and restart:</p>
              <pre className="text-xs text-slate-300 bg-slate-800 rounded p-3 font-mono leading-relaxed">{`TWILIO_ACCOUNT_SID=ACxxxxxxxxxxx\nTWILIO_AUTH_TOKEN=your-auth-token\nTWILIO_FROM_NUMBER=+441234567890`}</pre>
              <p className="text-xs text-slate-500">Sign up at <strong className="text-slate-400">twilio.com</strong> → get a UK number (~£1/month).</p>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">To (phone number)</label>
            <input type="tel" value={to} onChange={e => setTo(e.target.value)}
              placeholder="07700 900000"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <p className="text-[10px] text-slate-600">UK numbers auto-converted to +44 format</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-slate-400">Message</label>
              <span className={`text-[10px] ${charsLeft < 0 ? 'text-red-400' : charsLeft < 20 ? 'text-amber-400' : 'text-slate-600'}`}>
                {charsLeft} chars left
              </span>
            </div>
            <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none leading-relaxed" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-600">Sent via Twilio · ~4p per SMS</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            {sent ? (
              <span className="px-5 py-2 text-sm font-medium text-emerald-400">✓ Sent!</span>
            ) : (
              <button onClick={send} disabled={sending || !to.trim() || charsLeft < 0}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors">
                {sending ? 'Sending…' : '📱 Send SMS'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEmail(prospect: Lead): { subject: string; message: string } {
  const name    = prospect.company_name;
  const reasons = (prospect.notes ?? '').split(' · ').filter(Boolean);
  const issueLines = reasons
    .filter(r => r !== 'Website looks good')
    .map(r => `  • ${r}`)
    .join('\n');
  const subject = `Your website – quick note from Splendid Technology`;
  const hasNoWebsite = reasons.some(r => r.toLowerCase().includes('no website'));
  const message = hasNoWebsite
    ? `Hi ${name},\n\nI noticed your business doesn't currently have a website. In today's market, most customers search online before making a call — so not having a website means missing out on new enquiries every day.\n\nAt Splendid Technology, we build professional, mobile-friendly websites starting from just £499. We'd love to help get you online.\n\nWould you be open to a free 15-minute chat this week?\n\nBest regards,\nSplendid Technology\nhttps://splendidtechnology.co.uk`
    : `Hi ${name},\n\nI came across your website and noticed a few things that could be holding your business back online:\n\n${issueLines || '  • Several improvements available'}\n\nAt Splendid Technology, we help businesses like yours fix these issues quickly and affordably — with no jargon.\n\nWould you be open to a free 15-minute call this week to see if we can help?\n\nBest regards,\nSplendid Technology\nhttps://splendidtechnology.co.uk`;
  return { subject, message };
}

// ─── Email compose modal ─────────────────────────────────────────────────────
function EmailPanel({ prospect, onClose, onSent }: {
  prospect: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const draft = buildEmail(prospect);
  const [to,      setTo]      = useState(prospect.email ?? '');
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  async function send() {
    if (!to.trim() || !subject.trim() || !message.trim()) return;
    setSending(true); setError('');
    const res = await fetch('/api/prospects/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: prospect.id, to, subject, message }),
    });
    const data = await res.json();
    if (res.status === 503 && data.error === 'not_configured') {
      setNotConfigured(true); setSending(false); return;
    }
    if (!res.ok) { setError(data.error ?? 'Failed to send'); setSending(false); return; }
    setSent(true);
    setTimeout(() => { onSent(); onClose(); }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100">Send Outreach Email</h2>
            <p className="text-xs text-slate-500">{prospect.company_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {notConfigured && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 space-y-2">
              <div className="text-amber-300 font-semibold text-sm">⚠ SMTP Not Configured</div>
              <p className="text-xs text-slate-400">Add these to <span className="font-mono text-slate-300">.env.local</span> and restart the dev server:</p>
              <pre className="text-xs text-slate-300 bg-slate-800 rounded p-3 font-mono leading-relaxed">{`SMTP_USER=you@gmail.com\nSMTP_PASS=your-app-password\nSMTP_FROM_NAME=Splendid Technology`}</pre>
              <p className="text-xs text-slate-500">For Gmail: myaccount.google.com → Security → 2-Step Verification → App passwords.</p>
            </div>
          )}
          {prospect.notes && prospect.notes !== 'Website looks good' && (
            <div className="flex flex-wrap gap-1">
              {prospect.notes.split(' · ').filter(Boolean).map((r, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{r}</span>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">To</label>
            <input type="email" value={to} onChange={e => setTo(e.target.value)}
              placeholder="contact@theirbusiness.co.uk"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Message</label>
            <textarea rows={11} value={message} onChange={e => setMessage(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none font-mono leading-relaxed" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-600">Replies go to info@splendidtechnology.co.uk</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            {sent ? (
              <span className="px-5 py-2 text-sm font-medium text-emerald-400">✓ Sent!</span>
            ) : (
              <button onClick={send} disabled={sending || !to.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors">
                {sending ? 'Sending…' : '✉ Send Email'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ProspectsPage() {
  const [prospects,       setProspects]       = useState<Lead[]>([]);
  const [search,          setSearch]          = useState('');
  const [loading,         setLoading]         = useState(true);
  const [convertingId,    setConvertingId]    = useState<number | null>(null);
  const [markingId,       setMarkingId]       = useState<number | null>(null);
  const [emailTarget,     setEmailTarget]     = useState<Lead | null>(null);
  const [smsTarget,       setSmsTarget]       = useState<Lead | null>(null);
  const [filterContacted, setFilterContacted] = useState<'all' | 'contacted' | 'not_contacted'>('all');

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ stage: 'prospect' });
    if (search) p.set('search', search);
    const data = await fetch(`/api/leads?${p}`).then(r => r.json());
    setProspects(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  async function markContacted(id: number) {
    setMarkingId(id);
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacted_at: new Date().toISOString() }),
    });
    setMarkingId(null);
    fetchProspects();
  }

  async function convertToLead(id: number) {
    setConvertingId(id);
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'lead', status: 'new' }),
    });
    setConvertingId(null);
    fetchProspects();
  }

  const filtered = prospects.filter(p => {
    if (filterContacted === 'contacted')     return !!p.contacted_at;
    if (filterContacted === 'not_contacted') return !p.contacted_at;
    return true;
  });

  const contactedCount    = prospects.filter(p => !!p.contacted_at).length;
  const notContactedCount = prospects.filter(p => !p.contacted_at).length;

  return (
    <div className="space-y-5">
      {emailTarget && (
        <EmailPanel prospect={emailTarget} onClose={() => setEmailTarget(null)} onSent={fetchProspects} />
      )}
      {smsTarget && (
        <SmsPanel prospect={smsTarget} onClose={() => setSmsTarget(null)} onSent={fetchProspects} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Prospects</h1>
          <p className="text-sm text-slate-500">
            {prospects.length} total · {contactedCount} contacted · {notContactedCount} to contact
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/prospect-finder" className="px-3 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors">
            ⊙ Prospect Finder
          </Link>
          <Link href="/generate" className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
            ⚡ Generator
          </Link>
          <Link href="/prospects/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
            + New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="Search company, location, email…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        <div className="flex gap-1">
          {(['all', 'not_contacted', 'contacted'] as const).map(f => (
            <button key={f} onClick={() => setFilterContacted(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                filterContacted === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {f === 'all' ? `All (${prospects.length})` : f === 'contacted' ? `✉ Contacted (${contactedCount})` : `Pending (${notContactedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <p className="text-slate-400 font-medium">No prospects yet</p>
          <p className="text-slate-600 text-sm mt-1">Use the Prospect Finder or Generator to find businesses.</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link href="/prospect-finder" className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors">
              ⊙ Prospect Finder
            </Link>
            <Link href="/prospects/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              + New Prospect
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 text-center w-14">Score</th>
                  <th className="px-3 py-3 text-left">Company</th>
                  <th className="px-3 py-3 text-left">Contact</th>
                  <th className="px-3 py-3 text-left">Issues Found</th>
                  <th className="px-3 py-3 text-left">Outreach</th>
                  <th className="px-3 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${scoreColor(p.lead_score ?? 0)}`}>
                        {p.lead_score ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/leads/${p.id}`} className="font-medium text-slate-100 hover:text-blue-400 transition-colors text-sm">
                        {p.company_name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">{p.location ?? '—'}</div>
                      {p.sic_label && <div className="text-xs text-slate-600">{p.sic_label}</div>}
                    </td>
                    <td className="px-3 py-3">
                      {p.phone && <div className="text-xs text-slate-300">{p.phone}</div>}
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 block truncate max-w-[160px]">
                          {p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      )}
                      {p.email && <div className="text-xs text-slate-400 truncate max-w-[160px]">{p.email}</div>}
                      {!p.phone && !p.website && !p.email && <span className="text-xs text-slate-600">No contact info</span>}
                    </td>
                    <td className="px-3 py-3 max-w-[200px]">
                      {p.notes ? (
                        <div className="space-y-0.5">
                          {p.notes.split(' · ').filter(Boolean).slice(0, 3).map((r, i) => (
                            <div key={i} className="text-xs text-slate-400">· {r}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {p.contacted_at ? (
                        <div>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 font-medium">✉ Contacted</span>
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {new Date(p.contacted_at).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">Not contacted</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <button onClick={() => setEmailTarget(p)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                            p.contacted_at
                              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                              : 'bg-blue-700 hover:bg-blue-600 text-white'
                          }`}>
                          {p.contacted_at ? '✉ Send Again' : '✉ Send Email'}
                        </button>
                        {p.phone && (
                          <button onClick={() => setSmsTarget(p)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                              p.sms_sent_at
                                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                : 'bg-violet-700 hover:bg-violet-600 text-white'
                            }`}>
                            {p.sms_sent_at ? '📱 SMS Again' : '📱 Send SMS'}
                          </button>
                        )}
                        {!p.contacted_at && (
                          <button onClick={() => markContacted(p.id)} disabled={markingId === p.id}
                            className="text-xs px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 disabled:bg-slate-700 disabled:text-slate-500 text-emerald-200 rounded-lg font-medium transition-colors whitespace-nowrap">
                            {markingId === p.id ? 'Marking…' : '✓ Mark Contacted'}
                          </button>
                        )}
                        <button onClick={() => convertToLead(p.id)} disabled={convertingId === p.id}
                          className="text-xs px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-emerald-100 rounded-lg font-medium transition-colors whitespace-nowrap">
                          {convertingId === p.id ? 'Converting…' : '→ Convert to Lead'}
                        </button>
                        <Link href={`/leads/${p.id}`} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                          View details →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
