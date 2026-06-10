'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface AdAccount {
  id:   string;
  name: string;
  type: string;
}

interface LeadGenForm {
  id:     string;
  name:   string;
  status: string;
}

interface PreviewLead {
  id:         string;
  submittedAt: number;
  formName:   string;
  firstName?:  string;
  lastName?:   string;
  email?:      string;
  phone?:      string;
  company?:    string;
  jobTitle?:   string;
}

interface StatusData {
  connected: boolean;
  accounts:  AdAccount[];
  error?:    string;
}

interface SyncPreview {
  total: number;
  new:   number;
  leads: PreviewLead[];
}

export default function LinkedInPage() {
  const params = useSearchParams();
  const connectedParam = params.get('connected');
  const errorParam     = params.get('error');

  const [status, setStatus]             = useState<StatusData | null>(null);
  const [selectedAccount, setSelected]  = useState('');
  const [forms, setForms]               = useState<LeadGenForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [preview, setPreview]           = useState<SyncPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast]               = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/linkedin/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (connectedParam === '1') showToast('LinkedIn account connected!');
    if (errorParam)             showToast(`LinkedIn error: ${errorParam}`);
  }, [connectedParam, errorParam]);

  async function loadForms(accountId: string) {
    setLoadingForms(true);
    setForms([]);
    setPreview(null);
    setImportResult(null);
    const res = await fetch(`/api/linkedin/forms?accountId=${accountId}`);
    if (res.ok) setForms(await res.json());
    setLoadingForms(false);
  }

  async function loadPreview() {
    setLoadingPreview(true);
    setPreview(null);
    setImportResult(null);
    const res = await fetch(`/api/linkedin/sync?accountId=${selectedAccount}`);
    if (res.ok) setPreview(await res.json());
    setLoadingPreview(false);
  }

  async function importLeads() {
    setImporting(true);
    const res = await fetch(`/api/linkedin/sync?accountId=${selectedAccount}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setImportResult(data);
      showToast(`Imported ${data.created} lead(s) from LinkedIn.`);
      setPreview(null);
    }
    setImporting(false);
  }

  async function disconnect() {
    if (!confirm('Disconnect your LinkedIn account?')) return;
    setDisconnecting(true);
    await fetch('/api/linkedin/disconnect', { method: 'POST' });
    setStatus({ connected: false, accounts: [] });
    setSelected('');
    setForms([]);
    setPreview(null);
    setDisconnecting(false);
    showToast('LinkedIn disconnected.');
  }

  const configured = typeof window !== 'undefined'; // env vars are server-side only

  return (
    <div className="max-w-3xl space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-blue-500">in</span> LinkedIn Lead Generation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your LinkedIn Ads account to import leads from Lead Gen Forms.
          </p>
        </div>
        {status?.connected && (
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>

      {/* Connection card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {status === null ? (
          <p className="text-sm text-slate-500">Checking connection…</p>
        ) : status.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-emerald-400 font-medium">Connected to LinkedIn Ads</span>
            </div>

            {status.error && (
              <p className="text-sm text-amber-400 bg-amber-900/20 border border-amber-900 rounded-lg px-3 py-2">
                {status.error}
              </p>
            )}

            {/* Account selector */}
            {status.accounts.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Select Ad Account</label>
                <div className="flex gap-2">
                  <select
                    value={selectedAccount}
                    onChange={e => {
                      setSelected(e.target.value);
                      if (e.target.value) loadForms(e.target.value);
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- choose account --</option>
                    {status.accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active ad accounts found on this LinkedIn account.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Connect your LinkedIn Ads account to pull leads submitted through LinkedIn Lead Gen Forms directly into this CRM.
            </p>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-xs text-slate-400">
              <p className="font-semibold text-slate-300">Before connecting, ensure you have:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>A LinkedIn Developer App with <code>r_ads</code> and <code>r_ads_reporting</code> permissions</li>
                <li><code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code> set in your <code>.env</code></li>
                <li><code>LINKEDIN_REDIRECT_URI</code> set to <code>{'{YOUR_URL}'}/api/linkedin/callback</code></li>
              </ul>
            </div>
            <a
              href="/api/linkedin/connect"
              className="inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <span className="font-bold text-base leading-none">in</span>
              Connect LinkedIn Account
            </a>
          </div>
        )}
      </div>

      {/* Lead Gen Forms */}
      {selectedAccount && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Lead Gen Forms</h2>
          {loadingForms ? (
            <p className="text-sm text-slate-500">Loading forms…</p>
          ) : forms.length === 0 ? (
            <p className="text-sm text-slate-500">No lead gen forms found for this account.</p>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
              {forms.map(f => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm text-slate-200">{f.name}</div>
                    <div className="text-xs text-slate-500">{f.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {forms.length > 0 && !preview && !importResult && (
            <button
              onClick={loadPreview}
              disabled={loadingPreview}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm text-white rounded-lg transition-colors"
            >
              {loadingPreview ? 'Fetching leads…' : 'Preview new leads'}
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">
              {preview.new} new lead{preview.new !== 1 ? 's' : ''} ready to import
              <span className="ml-2 text-slate-500 font-normal">({preview.total} total responses)</span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={importLeads}
                disabled={importing || preview.new === 0}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white rounded-lg transition-colors"
              >
                {importing ? 'Importing…' : `Import ${preview.new} lead${preview.new !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {preview.new === 0 && (
            <p className="text-sm text-slate-500">All leads from this account have already been imported.</p>
          )}

          {preview.leads.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 max-h-96 overflow-y-auto">
              {preview.leads.map(l => (
                <div key={l.id} className="px-4 py-3 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-200">
                      {[l.firstName, l.lastName].filter(Boolean).join(' ') || '(no name)'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(l.submittedAt).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {[l.company, l.jobTitle].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[l.email, l.phone].filter(Boolean).join(' · ')}
                  </div>
                  {l.formName && <div className="text-xs text-slate-600">Form: {l.formName}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-5 space-y-2">
          <div className="text-sm font-medium text-emerald-400">Import complete</div>
          <div className="text-sm text-slate-300">
            {importResult.created} lead{importResult.created !== 1 ? 's' : ''} created ·{' '}
            {importResult.skipped} already imported
          </div>
          <Link
            href="/leads?source=linkedin"
            className="inline-block text-xs text-blue-400 hover:text-blue-300 underline mt-1"
          >
            View LinkedIn leads →
          </Link>
        </div>
      )}
    </div>
  );
}
