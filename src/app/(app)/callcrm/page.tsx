import Link from 'next/link';

const ITEMS = ['Campaigns', 'Dialer', 'Call Logs', 'Recordings'];

export default function CallCrmRootPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">CallCRM</h1>
        <p className="text-sm text-slate-600 mt-1">Calling operations are hosted in the dedicated CallCRM app.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Module Scope</h2>
        <div className="flex flex-wrap gap-2">
          {ITEMS.map((item) => (
            <span key={item} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{item}</span>
          ))}
        </div>
      </div>
      <Link href="/dashboard" className="text-sm text-blue-700 hover:text-blue-600">Back to CRM Dashboard</Link>
    </div>
  );
}
