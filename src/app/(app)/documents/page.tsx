'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type DocumentRow = {
  id: number;
  title: string;
  file_name: string;
  file_type: string;
  file_url: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  created_at: string;
};

const FILE_TYPES = ['pdf', 'docx', 'xlsx', 'image'] as const;

export default function DocumentsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');

  async function load() {
    const res = await fetch('/api/documents');
    if (res.ok) setRows(await res.json());
  }

  async function deleteDocument(id: number) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const payload = await res.json().catch(() => ({}));
      alert(payload?.error || 'Failed to delete document');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDocument() {
    if (!title.trim() || !fileName.trim()) return;
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl || null,
        company_id: companyId ? Number(companyId) : undefined,
        contact_id: contactId ? Number(contactId) : undefined,
      }),
    });
    setTitle('');
    setFileName('');
    setFileUrl('');
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Documents</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Attach Document</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File name" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {FILE_TYPES.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
          </select>
          <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL (optional)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Company ID (optional)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="Contact ID (optional)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={createDocument} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">
          Save Document
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-left px-3 py-2">Linked To</th>
              <th className="text-left px-3 py-2">Created</th>
              {isAdmin && <th className="text-right px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-800">{row.title}</td>
                <td className="px-3 py-2 text-slate-700 uppercase">{row.file_type}</td>
                <td className="px-3 py-2 text-slate-700">{row.file_url ? <a href={row.file_url} target="_blank" className="text-blue-700 hover:text-blue-600">{row.file_name}</a> : row.file_name}</td>
                <td className="px-3 py-2 text-slate-700">{row.contact_name || row.company_name || '-'}</td>
                <td className="px-3 py-2 text-slate-700">{new Date(row.created_at).toLocaleDateString('en-GB')}</td>
                {isAdmin && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteDocument(row.id)}
                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-3 py-8 text-center text-slate-500">No documents found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
