import Link from 'next/link';

const ITEMS = ['Campaigns', 'LinkedIn Campaigns', 'Email Campaigns', 'SMS Campaigns', 'Segments', 'Forms', 'Landing Pages', 'Newsletters'];

export default function MarketingRootPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketing</h1>
        <p className="text-sm text-slate-600 mt-1">Marketing execution is hosted in the dedicated Marketing app.</p>
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
