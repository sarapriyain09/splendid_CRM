import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import twilio from 'twilio';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WEBHOOK_BASE_URL, NEXTAUTH_URL } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Twilio credentials not set in .env.local' },
      { status: 503 },
    );
  }

  const body = await req.json() as { leadId: number; to: string };
  if (!body.leadId || !body.to) {
    return NextResponse.json({ error: 'leadId and to are required' }, { status: 400 });
  }

  // Look up the session user's phone number from the DB
  const db = getDb();
  const userId = (session.user as any)?.id;
  const userRow = userId ? db.prepare('SELECT phone FROM users WHERE id = ?').get(userId) as { phone?: string } | undefined : undefined;
  const callerPhone = userRow?.phone?.trim();

  if (!callerPhone) {
    return NextResponse.json(
      { error: 'No phone number set on your account. Ask an admin to add it in Settings.' },
      { status: 400 },
    );
  }

  // Normalise prospect number to E.164
  let prospectNumber = body.to.trim().replace(/\s+/g, '');
  if (prospectNumber.startsWith('0')) prospectNumber = '+44' + prospectNumber.slice(1);
  if (!prospectNumber.startsWith('+')) prospectNumber = '+44' + prospectNumber;

  // Normalise caller phone to E.164
  let callerE164 = callerPhone.replace(/\s+/g, '');
  if (callerE164.startsWith('0')) callerE164 = '+44' + callerE164.slice(1);
  if (!callerE164.startsWith('+')) callerE164 = '+44' + callerE164;

  // TwiML webhook URL — Twilio hits this when the caller answers to connect to prospect
  // Must be publicly reachable — use TWILIO_WEBHOOK_BASE_URL (public domain), not NEXTAUTH_URL (may be LAN IP)
  const baseUrl = TWILIO_WEBHOOK_BASE_URL ?? NEXTAUTH_URL ?? 'https://crm.splendidtechnology.co.uk';
  const twimlUrl = `${baseUrl}/api/prospects/call/twiml?to=${encodeURIComponent(prospectNumber)}&leadId=${body.leadId}`;

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Call the user's own phone first; when they answer, TwiML dials the prospect
    await client.calls.create({
      from: TWILIO_FROM_NUMBER,
      to: callerE164,
      url: twimlUrl,
    });

    // Log the call as a note on the lead
    const db = getDb();
    db.prepare(`
      INSERT INTO notes (lead_id, user_id, content, created_at)
      VALUES (@lead_id, @user_id, @body, datetime('now'))
    `).run({
      lead_id: body.leadId,
      user_id: (session.user as any)?.id ?? null,
      body: `📞 Outbound call initiated to ${body.to}`,
    });

    // Mark as contacted
    db.prepare(`
      UPDATE leads
      SET contacted_at = COALESCE(contacted_at, datetime('now')), updated_at = datetime('now')
      WHERE id = @id
    `).run({ id: body.leadId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[call]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate call' },
      { status: 500 },
    );
  }
}
