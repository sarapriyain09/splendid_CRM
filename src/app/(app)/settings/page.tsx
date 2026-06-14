'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User { id: number; name: string; email: string; role: string; phone?: string; created_at: string; }

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingPhone, setEditingPhone] = useState<{ [id: number]: string }>({});
  const [savingPhone, setSavingPhone] = useState<number | null>(null);

  const loadUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
  };

  useEffect(() => { loadUsers(); }, []);

  async function savePhone(userId: number) {
    setSavingPhone(userId);
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: editingPhone[userId] }),
    });
    setSavingPhone(null);
    loadUsers();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    setSaving(true);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess('User created successfully.');
      setForm({ name: '', email: '', password: '', role: 'user' });
      loadUsers();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to create user.');
    }
    setSaving(false);
  }

  async function deleteUser(id: number) {
    if (!confirm('Remove this user?')) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    loadUsers();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <Link href="/settings/templates" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg">
          Manage Outreach Templates
        </Link>
      </div>

      {/* Users */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Team Members</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-slate-200">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email} · {u.role}</div>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
                <input
                  type="tel"
                  placeholder="Phone for click-to-call"
                  value={editingPhone[u.id] ?? u.phone ?? ''}
                  onChange={e => setEditingPhone(p => ({ ...p, [u.id]: e.target.value }))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => savePhone(u.id)}
                  disabled={savingPhone === u.id}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 text-white text-xs rounded-lg transition-colors whitespace-nowrap">
                  {savingPhone === u.id ? '…' : 'Save'}
                </button>
              </div>
              <button onClick={() => deleteUser(u.id)}
                className="text-slate-600 hover:text-red-400 text-sm transition-colors">
                Remove
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="px-4 py-6 text-sm text-slate-600 text-center">No users found.</p>}
        </div>
      </div>

      {/* Add user */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Add Team Member</h2>
        <form onSubmit={addUser} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-900/20 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
          {success && <div className="text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-900 rounded-lg px-3 py-2">{success}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Full Name</label>
              <input type="text" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Password</label>
              <input type="password" required minLength={8} value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Add User'}
          </button>
        </form>
      </div>

      {/* LinkedIn integration */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">LinkedIn Lead Generation</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <p className="text-sm text-slate-400">
            Import leads from LinkedIn Lead Gen Forms. Set the following environment variables in your <code className="text-slate-300">.env</code> file, then connect from the{' '}
            <a href="/linkedin" className="text-blue-400 hover:text-blue-300 underline">LinkedIn Leads</a> page.
          </p>
          <div className="bg-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 space-y-1">
            <div>LINKEDIN_CLIENT_ID=<span className="text-slate-500">your_app_client_id</span></div>
            <div>LINKEDIN_CLIENT_SECRET=<span className="text-slate-500">your_app_client_secret</span></div>
            <div>LINKEDIN_REDIRECT_URI=<span className="text-slate-500">https://your-domain.com/api/linkedin/callback</span></div>
          </div>
          <p className="text-xs text-slate-500">
            Create a LinkedIn Developer App at{' '}
            <span className="text-slate-400">developer.linkedin.com</span> with the{' '}
            <code>r_ads</code> and <code>r_ads_reporting</code> OAuth scopes.
          </p>
        </div>
      </div>
    </div>
  );
}
