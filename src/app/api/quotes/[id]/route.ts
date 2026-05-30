import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import type { Quote, QuoteDetail } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const quote = db.prepare('SELECT q.*, l.company_name FROM quotes q LEFT JOIN leads l ON q.lead_id = l.id WHERE q.id = ?').get(id) as (QuoteDetail & { company_name?: string }) | undefined;
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  quote.items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(id) as QuoteDetail['items'];
  return NextResponse.json(quote);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const body = await req.json() as Partial<Quote> & { items?: QuoteDetail['items'] };

  if (body.items !== undefined) {
    db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(id);
    const insertItem = db.prepare('INSERT INTO quote_items (quote_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
    const subtotal = body.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const vatRate  = body.vat_rate ?? 20;
    body.subtotal   = subtotal;
    body.vat_amount = subtotal * vatRate / 100;
    body.total      = subtotal + body.vat_amount;
    for (const item of body.items) insertItem.run(id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    delete (body as Record<string, unknown>).items;
  }

  const fields = Object.keys(body).filter(k => !['id','items'].includes(k));
  if (fields.length > 0) {
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE quotes SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({ ...body, id });
  }

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteDetail;
  quote.items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(id) as QuoteDetail['items'];
  return NextResponse.json(quote);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  getDb().prepare('DELETE FROM quotes WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
