'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type TabKey =
  | 'activities'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'salesOpportunities'
  | 'quotations'
  | 'marketingCampaignHistory'
  | 'callHistory';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'activities', label: 'Activities' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'documents', label: 'Documents' },
  { key: 'salesOpportunities', label: 'Sales Opportunities (Read-only)' },
  { key: 'quotations', label: 'Quotations (Read-only)' },
  { key: 'marketingCampaignHistory', label: 'Marketing Campaign History (Read-only)' },
  { key: 'callHistory', label: 'Call History (Read-only)' },
];

type ContactDetailResponse = {
  contact?: {
    id: number | string;
    lead_id?: number | null;
    company_id?: number | string | null;
    company_name?: string | null;
    name?: string | null;
    job_title?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    linkedin?: string | null;
    linkedin_url?: string | null;
  };
  tabs?: Partial<Record<TabKey, Record<string, unknown>[]>>;
  error?: string;
};

const CONTACT_STATUS_OPTIONS = ['Pending', 'Connected', 'Message1', 'Interested', 'Qualified'];

export default function ContactDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { data: sessionData } = useSession();
  const isAdmin = (sessionData?.user as { role?: string } | undefined)?.role === 'admin';
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [active, setActive] = useState<TabKey>('activities');
  const [data, setData] = useState<ContactDetailResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState('Pending');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // AI research assistant state.
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiWebSearch, setAiWebSearch] = useState(false);
  const [aiFields, setAiFields] = useState<{
    job_title?: string | null;
    email?: string | null;
    linkedin_url?: string | null;
    company_name?: string | null;
    description?: string | null;
  } | null>(null);

  const [activityType, setActivityType] = useState('connection_sent');
  const [activityNotes, setActivityNotes] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);

  const [taskSubject, setTaskSubject] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentFileType, setDocumentFileType] = useState('pdf');
  const [documentFileUrl, setDocumentFileUrl] = useState('');
  const [addingDocument, setAddingDocument] = useState(false);

  const loadContact = useCallback(async () => {
    if (!id) return;

    const response = await fetch(`/api/contacts/${id}`);
    const text = await response.text();
    const payload = (text ? JSON.parse(text) : {}) as ContactDetailResponse;

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load contact');
    }

    setData(payload);
    setName(payload.contact?.name ?? '');
    setCompanyName(payload.contact?.company_name ?? '');
    setJobTitle(payload.contact?.job_title ?? '');
    setEmail(payload.contact?.email ?? '');
    setPhone(payload.contact?.phone ?? '');
    setStatus(payload.contact?.status ?? 'Pending');
    setLinkedinUrl(payload.contact?.linkedin_url ?? payload.contact?.linkedin ?? '');
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      try {
        setPageError(null);
        await loadContact();
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setPageError(err instanceof Error ? err.message : 'Failed to load contact');
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, loadContact]);

  const rows = useMemo(() => {
    if (!data?.tabs) return [];
    return Array.isArray(data.tabs[active]) ? data.tabs[active] : [];
  }, [data, active]);

  const saveContact = async () => {
    if (!id || !data?.contact?.id) return;

    setSaving(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          company_name: companyName.trim(),
          job_title: jobTitle.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          status,
          linkedin_url: linkedinUrl.trim() || null,
          linkedin: linkedinUrl.trim() || null,
        }),
      });

      const payload = (await response.json()) as Record<string, unknown> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update contact');
      }

      setData((prev) => {
        if (!prev?.contact) return prev;
        return {
          ...prev,
          contact: {
            ...prev.contact,
            name: (payload.name as string | null | undefined) ?? (name.trim() || null),
            company_name: (payload.company_name as string | null | undefined) ?? (companyName.trim() || null),
            job_title: (payload.job_title as string | null | undefined) ?? (jobTitle.trim() || null),
            email: (payload.email as string | null | undefined) ?? (email.trim() || null),
            phone: (payload.phone as string | null | undefined) ?? (phone.trim() || null),
            status: (payload.status as string | null | undefined) ?? status,
            linkedin_url: (payload.linkedin_url as string | null | undefined) ?? (linkedinUrl.trim() || null),
            linkedin: (payload.linkedin as string | null | undefined) ?? (linkedinUrl.trim() || null),
          },
        };
      });
      setActionSuccess('LinkedIn status/profile updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const addActivity = async () => {
    if (!data?.contact?.id) return;
    setAddingActivity(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: data.contact.id,
          lead_id: data.contact.lead_id ?? null,
          activity_type: activityType,
          notes: activityNotes.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to add activity');

      setActivityNotes('');
      await loadContact();
      setActionSuccess('Activity added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add activity');
    } finally {
      setAddingActivity(false);
    }
  };

  const addTask = async () => {
    if (!data?.contact?.id) return;
    if (!taskSubject.trim()) {
      setActionError('Task subject is required.');
      return;
    }
    if (!data.contact.lead_id) {
      setActionError('This contact has no linked lead, so tasks cannot be attached from this page.');
      return;
    }

    setAddingTask(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: data.contact.lead_id,
          subject: taskSubject.trim(),
          description: taskDescription.trim() || null,
          priority: taskPriority,
          due_date: taskDueDate || null,
          status: 'Open',
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to add task');

      setTaskSubject('');
      setTaskDescription('');
      setTaskPriority('Medium');
      setTaskDueDate('');
      await loadContact();
      setActionSuccess('Task added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const addNote = async () => {
    if (!data?.contact?.id) return;
    if (!noteContent.trim()) {
      setActionError('Note content is required.');
      return;
    }

    setAddingNote(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent.trim(),
          contact_id: data.contact.id,
          company_id: data.contact.company_id ?? null,
          lead_id: data.contact.lead_id ?? null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to add note');

      setNoteContent('');
      await loadContact();
      setActionSuccess('Note added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const addDocument = async () => {
    if (!data?.contact?.id) return;
    if (!documentTitle.trim() || !documentFileName.trim()) {
      setActionError('Document title and file name are required.');
      return;
    }

    setAddingDocument(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentTitle.trim(),
          file_name: documentFileName.trim(),
          file_type: documentFileType,
          file_url: documentFileUrl.trim() || null,
          contact_id: data.contact.id,
          company_id: data.contact.company_id ?? null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to add document');

      setDocumentTitle('');
      setDocumentFileName('');
      setDocumentFileType('pdf');
      setDocumentFileUrl('');
      await loadContact();
      setActionSuccess('Document added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setAddingDocument(false);
    }
  };

  if (pageError) {
    return <div className="text-red-600">{pageError}</div>;
  }

  if (!data?.contact) {
    return <div className="text-slate-600">Loading contact...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{data.contact.name}</h1>
        <p className="text-sm text-slate-600 mt-1">{data.contact.email ?? '-'} · {data.contact.phone ?? '-'}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Contact Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <label className="text-sm text-slate-700">
            <span className="block mb-1">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="block mb-1">Company</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="block mb-1">Job Title</span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Job title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="block mb-1">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="block mb-1">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="block mb-1">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {Array.from(new Set([...CONTACT_STATUS_OPTIONS, data.contact.status ?? 'Pending'])).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            <span className="block mb-1">LinkedIn Profile URL</span>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveContact}
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save LinkedIn Update'}
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                if (!id) return;
                if (!confirm(`Delete contact "${name || ''}"? This cannot be undone.`)) return;
                const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
                if (res.ok) {
                  router.push('/contacts');
                } else {
                  const payload = await res.json().catch(() => ({}));
                  setActionError(payload?.error || 'Failed to delete contact');
                }
              }}
              className="inline-flex items-center rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50"
            >
              Delete Contact
            </button>
          )}
          {linkedinUrl.trim() ? (
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:text-blue-600">
              Open profile
            </a>
          ) : null}
        </div>
        {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        {actionSuccess ? <p className="mt-3 text-sm text-emerald-700">{actionSuccess}</p> : null}
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-indigo-900">AI Research Assistant</h2>
          <span className="text-[11px] text-indigo-500">Searches the web to find contact details</span>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Ask anything about <span className="font-medium">{name || 'this contact'}</span>
          {companyName ? <> at <span className="font-medium">{companyName}</span></> : null} — e.g. &quot;Find their LinkedIn and job title&quot;.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || aiLoading) return;
              (async () => {
                if (!name.trim() && !aiQuestion.trim()) { setAiError('Enter a contact name or a question first.'); return; }
                setAiLoading(true); setAiError(null); setAiAnswer(null); setAiFields(null);
                try {
                  const res = await fetch('/api/ai/company-research', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'contact', contactName: name.trim(), name: companyName.trim() || undefined, jobTitle: jobTitle.trim() || undefined, question: aiQuestion.trim() || undefined }),
                  });
                  const payload = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(payload?.error || 'Research failed.');
                  setAiAnswer(payload.answer ?? null); setAiFields(payload.fields ?? null); setAiWebSearch(Boolean(payload.usedWebSearch));
                } catch (err) { setAiError(err instanceof Error ? err.message : 'Research failed.'); }
                finally { setAiLoading(false); }
              })();
            }}
            placeholder="Ask anything (optional) — leave blank to auto-research this contact"
            className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={async () => {
              if (!name.trim() && !aiQuestion.trim()) { setAiError('Enter a contact name or a question first.'); return; }
              setAiLoading(true); setAiError(null); setAiAnswer(null); setAiFields(null);
              try {
                const res = await fetch('/api/ai/company-research', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: 'contact', contactName: name.trim(), name: companyName.trim() || undefined, jobTitle: jobTitle.trim() || undefined, question: aiQuestion.trim() || undefined }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(payload?.error || 'Research failed.');
                setAiAnswer(payload.answer ?? null); setAiFields(payload.fields ?? null); setAiWebSearch(Boolean(payload.usedWebSearch));
              } catch (err) { setAiError(err instanceof Error ? err.message : 'Research failed.'); }
              finally { setAiLoading(false); }
            }}
            disabled={aiLoading}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
          >
            {aiLoading ? 'Researching...' : 'Research'}
          </button>
        </div>
        {aiError ? <div className="mt-2 text-sm text-red-600">{aiError}</div> : null}
        {aiAnswer ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-700">Answer</span>
              <span className="text-[11px] text-slate-400">{aiWebSearch ? 'Web search' : 'From general knowledge'}</span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{aiAnswer}</p>
            {aiFields?.description ? <p className="text-xs text-slate-500 mt-2 italic">{aiFields.description}</p> : null}
          </div>
        ) : null}
        {aiFields && (aiFields.job_title || aiFields.email || aiFields.linkedin_url || aiFields.company_name) ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">Suggested values</span>
              <button
                onClick={() => {
                  if (aiFields?.job_title) setJobTitle(aiFields.job_title);
                  if (aiFields?.email) setEmail(aiFields.email);
                  if (aiFields?.linkedin_url) setLinkedinUrl(aiFields.linkedin_url);
                  if (aiFields?.company_name) setCompanyName(aiFields.company_name);
                }}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-600"
              >
                Apply all
              </button>
            </div>
            {([
              ['Job title', aiFields?.job_title, () => aiFields?.job_title && setJobTitle(aiFields.job_title!)],
              ['Email', aiFields?.email, () => aiFields?.email && setEmail(aiFields.email!)],
              ['LinkedIn', aiFields?.linkedin_url, () => aiFields?.linkedin_url && setLinkedinUrl(aiFields.linkedin_url!)],
              ['Company', aiFields?.company_name, () => aiFields?.company_name && setCompanyName(aiFields.company_name!)],
            ] as Array<[string, string | null | undefined, () => void]>).map(([label, value, apply]) =>
              value ? (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-500">{label}:</span>{' '}
                    <span className="text-slate-800 break-all">{value}</span>
                  </div>
                  <button onClick={apply} className="text-xs text-indigo-700 hover:text-indigo-600 flex-shrink-0">Apply</button>
                </div>
              ) : null
            )}
            <p className="text-[11px] text-slate-400 pt-1">Review suggestions, then click Save to persist.</p>
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm ${active === tab.key ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === 'activities' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Activity</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="connection_sent">Connection Sent</option>
              <option value="accepted">Accepted</option>
              <option value="message_sent">Message Sent</option>
              <option value="replied">Replied</option>
              <option value="meeting_booked">Meeting Booked</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
            </select>
            <input
              value={activityNotes}
              onChange={(e) => setActivityNotes(e.target.value)}
              placeholder="Optional notes"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
          </div>
          <button
            onClick={addActivity}
            disabled={addingActivity}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {addingActivity ? 'Adding...' : 'Add Activity'}
          </button>
        </div>
      ) : null}

      {active === 'tasks' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Task</h3>
          <input
            value={taskSubject}
            onChange={(e) => setTaskSubject(e.target.value)}
            placeholder="Task subject"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addTask}
            disabled={addingTask}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {addingTask ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      ) : null}

      {active === 'notes' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Note</h3>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write note"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addNote}
            disabled={addingNote}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {addingNote ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      ) : null}

      {active === 'documents' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Document</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Title"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={documentFileName}
              onChange={(e) => setDocumentFileName(e.target.value)}
              placeholder="File name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={documentFileType}
              onChange={(e) => setDocumentFileType(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="image">Image</option>
            </select>
            <input
              value={documentFileUrl}
              onChange={(e) => setDocumentFileUrl(e.target.value)}
              placeholder="File URL (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addDocument}
            disabled={addingDocument}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {addingDocument ? 'Adding...' : 'Add Document'}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No records in this tab.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row: Record<string, unknown>, idx: number) => (
              <div key={String(row.id ?? idx)} className="border border-slate-100 rounded-lg p-3 bg-slate-50 text-sm">
                <pre className="whitespace-pre-wrap text-slate-700">{JSON.stringify(row, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
