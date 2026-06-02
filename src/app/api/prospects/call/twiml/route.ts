import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Twilio hits this URL when Raja answers his phone.
// We respond with TwiML that announces recording then dials the prospect.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to     = searchParams.get('to');
  const leadId = searchParams.get('leadId');

  if (!to) {
    return new NextResponse('<Response><Say>Error: no destination number.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://crm.splendidtechnology.co.uk';
  const recordingCallbackUrl = `${baseUrl}/api/prospects/call/recording?leadId=${leadId ?? ''}`;

  const twiml = new twilio.twiml.VoiceResponse();

  // UK legal requirement: inform all parties the call is recorded
  twiml.say(
    { voice: 'Polly.Amy', language: 'en-GB' },
    'This call will be recorded for quality and training purposes. Connecting you now.',
  );

  const dial = twiml.dial({
    callerId: process.env.TWILIO_FROM_NUMBER,
    record: 'record-from-answer-dual',
    recordingStatusCallback: recordingCallbackUrl,
    recordingStatusCallbackMethod: 'POST',
  });
  dial.number(to);

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Twilio may send GET for some configurations
export async function GET(req: NextRequest) {
  return POST(req);
}
