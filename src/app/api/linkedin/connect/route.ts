import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { buildAuthUrl, LI_CLIENT_ID, LI_REDIRECT_URI } from '@/lib/linkedin';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  if (!LI_CLIENT_ID || !LI_REDIRECT_URI) {
    return NextResponse.json({ error: 'LinkedIn app credentials not configured.' }, { status: 503 });
  }

  // Generate a random state value to guard against CSRF
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a short-lived cookie (10 min)
  const url  = buildAuthUrl(state);
  const resp = NextResponse.redirect(url);
  resp.cookies.set('li_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600,
    path:     '/',
    sameSite: 'lax',
  });
  return resp;
}
