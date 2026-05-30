import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import type { Quote, QuoteDetail } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const db = getDb();
  const quotes = db.prepare('SELECT q.*, l.company_name FROM quotes q LEFT JOIN leads l ON q.lead_id = l.id ORDER BY q.created_at DESC').all();
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const db = getDb();
  const body = await req.json() as Partial<Quote> & { items?: QuoteDetail['items'] };

  // Generate quote number: Q-YYYYMM-NNN
  const count = (db.prepare('SELECT COUNT(*) as c FROM quotes').get() as { c: number }).c;
  const qNum  = `Q-${new Date().toISOString().slice(0,7).replace('-','')}-${String(count + 1).padStart(3,'0')}`;

  const items  = body.items ?? [];
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const vatRate  = body.vat_rate ?? 20;
  const vatAmt   = subtotal * vatRate / 100;
  const total    = subtotal + vatAmt;

  const result = db.prepare(`
    INSERT INTO quotes (lead_id, quote_number, status, customer, address, email, subtotal, vat_rate, vat_amount, total, terms, notes, expiry_date)
    VALUES (@lead_id, @quote_number, @status, @customer, @address, @email, @subtotal, @vat_rate, @vat_amount, @total, @terms, @notes, @expiry_date)
  `).run({
    lead_id:     body.lead_id     ?? null,
    quote_number: qNum,
    status:      body.status      ?? 'draft',
    customer:    body.customer    ?? '',
    address:     body.address     ?? null,
    email:       body.email       ?? null,
    subtotal,
    vat_rate:    vatRate,
    vat_amount:  vatAmt,
    total,
    terms:       body.terms       ?? '30 days',
    notes:       body.notes       ?? null,
    expiry_date: body.expiry_date ?? null,
  });

  const insertItem = db.prepare('INSERT INTO quote_items (quote_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) {
    insertItem.run(result.lastInsertRowid, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid) as QuoteDetail;
  quote.items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(result.lastInsertRowid) as QuoteDetail['items'];
  return NextResponse.json(quote, { status: 201 });
}
