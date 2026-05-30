'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { PRODUCTS } from '@/lib/types';

interface LineItem { description: string; quantity: number; unit_price: number; vat_rate: number; }

function NewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState(searchParams.get('lead_id') ?? '');
  const [customerName, setCustomerName] = useState(searchParams.get('customer') ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
  ]);

  // Default expiry: 30 days from today
  useEffect(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    setExpiresAt(d.toISOString().slice(0, 10));
  }, []);

  const addItem = () => setItems(p => [...p, { description: '', quantity: 1, unit_price: 0, vat_rate: 20 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof LineItem, v: string | number) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vat = items.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
  const total = subtotal + vat;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || items.some(it => !it.description.trim())) return;
    setSaving(true);
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId ? Number(leadId) : null,
        customer_name: customerName,
        expires_at: expiresAt || null,
        notes,
        items,
      }),
    });
    if (res.ok) {
      const q = await res.json();
      router.push(`/quotes/${q.id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/quotes" className="hover:text-slate-300">Quotes</Link>
          <span>/</span>
          <span>New Quote</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">New Quote</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Customer Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Customer / Company Name *</label>
              <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Lead ID (optional)</label>
              <input type="number" value={leadId} onChange={e => setLeadId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Expires</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Line Items</h2>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                {i === 0 && <label className="text-xs text-slate-500 mb-1 block">Description</label>}
                <input
                  list="products" type="text" required placeholder="Description"
                  value={item.description} onChange={e => setItem(i, 'description', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="text-xs text-slate-500 mb-1 block">Qty</label>}
                <input type="number" min="1" value={item.quantity} onChange={e => setItem(i, 'quantity', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="text-xs text-slate-500 mb-1 block">Unit £</label>}
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem(i, 'unit_price', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="text-xs text-slate-500 mb-1 block">VAT %</label>}
                <select value={item.vat_rate} onChange={e => setItem(i, 'vat_rate', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={20}>20%</option>
                </select>
              </div>
              <div className="col-span-1 flex items-end pb-0.5">
                {i === 0 && <div className="mb-1 h-4" />}
                <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                  className="w-full py-2 text-slate-600 hover:text-red-400 disabled:opacity-30 text-lg leading-none transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ))}
          <datalist id="products">
            {PRODUCTS.map(p => <option key={p} value={p} />)}
          </datalist>
          <button type="button" onClick={addItem}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            + Add line item
          </button>

          {/* Totals */}
          <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT</span><span>£{vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-100 text-base pt-1 border-t border-slate-800">
              <span>Total</span><span>£{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
          <label className="text-xs font-medium text-slate-400">Notes / Terms</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Payment terms, notes, conditions…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create Quote'}
          </button>
          <Link href="/quotes" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewQuotePage() {
  return <Suspense><NewQuoteForm /></Suspense>;
}
