'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Lead, Contact, Note, Task, Quote } from '@/lib/types';
import { PIPELINE_STAGES, LEAD_SOURCES } from '@/lib/types';

interface LeadDetail { lead: Lead; contacts: Contact[]; notes: Note[]; tasks: Task[]; quotes: Quote[]; }

const STAGE_COLORS: Record<string, string> = {
  lead:'bg-slate-800 text-slate-300', contacted:'bg-blue-900 text-blue-300',
  meeting_scheduled:'bg-violet-900 text-violet-300', requirements:'bg-amber-900 text-amber-300',
  proposal_sent:'bg-orange-900 text-orange-300', negotiation:'bg-rose-900 text-rose-300',
  won:'bg-emerald-900 text-emerald-300', lost:'bg-red-900 text-red-300',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LeadDetail | null>(null);
  const [tab, setTab] = useState<'overview'|'contacts'|'notes'|'tasks'|'quotes'>('overview');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [newContact, setNewContact] = useState({ name:'', role:'', email:'', phone:'', linkedin:'' });
  const [addingContact, setAddingContact] = useState(false);
  const [newTask, setNewTask] = useState({ title:'', due_date:'' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`);
    if (!res.ok) { router.push('/leads'); return; }
    setData(await res.json());
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function updateStage(stage: string) {
    await fetch(`/api/leads/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ stage }) });
    load();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    await fetch(`/api/leads/${id}/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: noteText }) });
    setNoteText('');
    setSavingNote(false);
    load();
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact.name.trim()) return;
    setAddingContact(true);
    await fetch(`/api/leads/${id}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newContact) });
    setNewContact({ name:'', role:'', email:'', phone:'', linkedin:'' });
    setAddingContact(false);
    load();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...newTask, lead_id: id }) });
    setNewTask({ title:'', due_date:'' });
    load();
  }

  async function toggleTask(taskId: number, done: number) {
    await fetch(`/api/tasks/${taskId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ done: done ? 0 : 1 }) });
    load();
  }

  async function disqualifyLead() {
    if (!confirm('Mark this lead as disqualified (Lost)? You can reopen it later by changing the stage.')) return;
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'lost', status: 'rejected' }),
    });
    load();
  }

  async function deleteLead() {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    await fetch(`/api/leads/${id}`, { method:'DELETE' });
    router.push('/leads');
  }

  if (!data) return <div className="p-12 text-center text-slate-500 animate-pulse">Loading…</div>;
  const { lead, contacts, notes, tasks, quotes } = data;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/leads" className="hover:text-slate-300">Leads</Link>
            <span>/</span>
            <span>{lead.company_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{lead.company_name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[lead.stage] ?? 'bg-slate-800 text-slate-400'}`}>
              {PIPELINE_STAGES.find(s => s.key === lead.stage)?.label ?? lead.stage}
            </span>
            {lead.location && <span className="text-xs text-slate-400">{lead.location}</span>}
            {lead.incorporated && <span className="text-xs text-slate-500">Est. {lead.incorporated}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/quotes/new?lead_id=${lead.id}&customer=${encodeURIComponent(lead.company_name)}`}
            className="px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors">
            + Quote
          </Link>
          {lead.stage !== 'lost' && lead.status !== 'rejected' && (
            <button onClick={disqualifyLead} className="px-3 py-2 bg-slate-800 hover:bg-orange-900 text-slate-400 hover:text-orange-300 text-sm rounded-lg transition-colors">
              ✕ Disqualify
            </button>
          )}
          <button onClick={deleteLead} className="px-3 py-2 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 text-sm rounded-lg transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex gap-1 flex-wrap">
          {PIPELINE_STAGES.map((s, i) => (
            <button key={s.key} onClick={() => updateStage(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                lead.stage === s.key ? `${STAGE_COLORS[s.key]} ring-1 ring-current` : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}>
              {i > 0 && <span className="mr-1 opacity-40">→</span>}{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-0.5">
          {(['overview','contacts','notes','tasks','quotes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t}
              {t === 'notes'    && notes.length    > 0 && <span className="ml-1.5 text-xs bg-slate-700 px-1.5 py-0.5 rounded">{notes.length}</span>}
              {t === 'contacts' && contacts.length > 0 && <span className="ml-1.5 text-xs bg-slate-700 px-1.5 py-0.5 rounded">{contacts.length}</span>}
              {t === 'tasks'    && tasks.filter(t=>!t.done).length > 0 && <span className="ml-1.5 text-xs bg-amber-800 text-amber-300 px-1.5 py-0.5 rounded">{tasks.filter(t=>!t.done).length}</span>}
              {t === 'quotes'   && quotes.length   > 0 && <span className="ml-1.5 text-xs bg-slate-700 px-1.5 py-0.5 rounded">{quotes.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Company Info</h3>
            {[
              ['Company No.',  lead.company_number],
              ['SIC Code',     lead.sic_code ? `${lead.sic_code} — ${lead.sic_label ?? ''}` : null],
              ['Website',      lead.website],
              ['Phone',        lead.phone],
              ['Email',        lead.email],
              ['Location',     lead.location],
              ['Postcode',     lead.postcode],
              ['Incorporated', lead.incorporated],
              ['Source',       lead.source?.replace('_',' ')],
            ].map(([k,v]) => v ? (
              <div key={k as string} className="flex gap-2">
                <span className="text-xs text-slate-500 w-28 flex-shrink-0 pt-0.5">{k}</span>
                <span className="text-sm text-slate-200 break-all">
                  {k === 'Website' ? <a href={v as string} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">{v}</a> : v}
                </span>
              </div>
            ) : null)}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Lead Score</h3>
            <div className={`text-5xl font-bold ${lead.lead_score >= 70 ? 'text-red-400' : lead.lead_score >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
              {lead.lead_score}
            </div>
            <div className="text-xs text-slate-500">
              {lead.lead_score >= 70 ? '🔴 HOT — Priority contact' : lead.lead_score >= 50 ? '🟡 WARM — Follow up soon' : lead.lead_score >= 30 ? '🔵 COOL — Monitor' : '⚫ COLD'}
            </div>
            {lead.company_number && (
              <a href={`https://find-and-update.company-information.service.gov.uk/company/${lead.company_number}`}
                target="_blank" rel="noreferrer"
                className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300">
                View on Companies House →
              </a>
            )}
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          {contacts.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-medium text-slate-100">{c.name} {c.is_primary ? <span className="ml-1 text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">Primary</span> : null}</div>
                {c.role  && <div className="text-xs text-slate-400">{c.role}</div>}
                {c.email && <div className="text-xs text-slate-400"><a href={`mailto:${c.email}`} className="text-blue-400 hover:text-blue-300">{c.email}</a></div>}
                {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">LinkedIn →</a>}
              </div>
              <button onClick={async () => { await fetch(`/api/leads/${id}/contacts?contact_id=${c.id}`, {method:'DELETE'}); load(); }}
                className="text-slate-600 hover:text-red-400 text-sm transition-colors">✕</button>
            </div>
          ))}
          <form onSubmit={addContact} className="bg-slate-900 border border-slate-700 border-dashed rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-400">Add Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { ph:'Name *',    key:'name'     },
                { ph:'Role',      key:'role'     },
                { ph:'Email',     key:'email'    },
                { ph:'Phone',     key:'phone'    },
                { ph:'LinkedIn URL', key:'linkedin', full:true },
              ].map(f => (
                <input key={f.key} type="text" placeholder={f.ph}
                  value={(newContact as Record<string,string>)[f.key]}
                  onChange={e => setNewContact(p => ({...p, [f.key]:e.target.value}))}
                  className={`bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 ${f.full ? 'col-span-2' : ''}`}
                />
              ))}
            </div>
            <button type="submit" disabled={addingContact || !newContact.name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
              Add Contact
            </button>
          </form>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <form onSubmit={addNote} className="flex gap-3">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button type="submit" disabled={savingNote || !noteText.trim()}
              className="px-4 py-2 h-fit bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors self-start">
              Save
            </button>
          </form>
          {notes.length === 0 && <p className="text-slate-600 text-sm text-center py-6">No notes yet.</p>}
          {notes.map(n => (
            <div key={n.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-2">{n.user_name ?? 'System'} · {n.created_at.slice(0,16).replace('T',' ')}</div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <form onSubmit={addTask} className="flex gap-3">
            <input type="text" placeholder="Task title…" value={newTask.title} onChange={e => setNewTask(p=>({...p,title:e.target.value}))}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <input type="date" value={newTask.due_date} onChange={e => setNewTask(p=>({...p,due_date:e.target.value}))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            <button type="submit" disabled={!newTask.title.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
              Add
            </button>
          </form>
          {tasks.length === 0 && <p className="text-slate-600 text-sm text-center py-6">No tasks yet.</p>}
          {tasks.map(t => (
            <div key={t.id} className={`flex items-center gap-3 bg-slate-900 border rounded-xl px-4 py-3 ${t.done ? 'border-slate-800 opacity-50' : 'border-slate-700'}`}>
              <button onClick={() => toggleTask(t.id, Number(t.done))}
                className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${t.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 hover:border-emerald-500'}`}>
                {t.done ? '✓' : ''}
              </button>
              <span className={`flex-1 text-sm ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{t.title}</span>
              {t.due_at && <span className="text-xs text-slate-500">{t.due_at}</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="space-y-3">
          <Link href={`/quotes/new?lead_id=${lead.id}&customer=${encodeURIComponent(lead.company_name)}`}
            className="inline-block px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors">
            + New Quote
          </Link>
          {quotes.length === 0 && <p className="text-slate-600 text-sm text-center py-6">No quotes yet.</p>}
          {quotes.map(q => (
            <Link key={q.id} href={`/quotes/${q.id}`}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:bg-slate-800 transition-colors">
              <div>
                <div className="font-medium text-slate-200">{q.quote_number}</div>
                <div className="text-xs text-slate-500">{q.created_at.slice(0,10)} · {q.status}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-100">£{q.total.toLocaleString()}</div>
                <div className="text-xs text-slate-500">inc. VAT</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
