'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { QuoteDetail } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-800 text-slate-400',
  sent: 'bg-blue-900 text-blue-300',
  accepted: 'bg-emerald-900 text-emerald-300',
  rejected: 'bg-red-900 text-red-300',
  expired: 'bg-orange-900 text-orange-300',
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/quotes').then(r => r.json()).then(d => { setQuotes(d); setLoading(false); });
  }, []);

  const totalValue = quotes.filter(q => q.status !== 'rejected').reduce((s, q) => s + q.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Quotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pipeline value: £{totalValue.toLocaleString()}</p>
        </div>
        <Link href="/quotes/new" className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors">
          + New Quote
        </Link>
      </div>

      {loading && <div className="text-center text-slate-500 py-12 animate-pulse">Loading…</div>}

      {!loading && quotes.length === 0 && (
        <div className="text-center py-20 text-slate-600">No quotes yet. Create your first quote.</div>
      )}

      {!loading && quotes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="text-left px-4 py-3 font-medium">Quote No.</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Expires</th>
                <th className="text-right px-4 py-3 font-medium">Total (inc VAT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-slate-800 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{q.quote_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {q.lead_id ? <Link href={`/leads/${q.lead_id}`} className="hover:text-blue-400">{q.customer_name}</Link> : q.customer_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[q.status] ?? 'bg-slate-800 text-slate-400'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{q.created_at.slice(0,10)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{q.expires_at?.slice(0,10) ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-100">£{q.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
