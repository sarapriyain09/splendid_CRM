/**
 * TPS / CTPS checker
 *
 * Checks a UK phone number against the Telephone Preference Service (TPS) and
 * Corporate Telephone Preference Service (CTPS) before an outbound call is made.
 *
 * TPS  — individuals who have opted out of unsolicited sales calls.
 * CTPS — businesses/organisations that have opted out.
 *
 * The official API is provided by the Direct Marketing Association (DMA):
 *   https://www.tpsonline.org.uk
 *
 * Required environment variables:
 *   TPS_API_KEY   — your TPS Online API key (obtain from tpsonline.org.uk)
 *   TPS_API_URL   — (optional) override the API base URL; defaults to the DMA endpoint
 */

export type TpsStatus = 'clean' | 'tps' | 'ctps' | 'tps_and_ctps' | 'unchecked';

export interface TpsResult {
  status: TpsStatus;
  /** true when we successfully reached the API */
  checked: boolean;
  /** ISO timestamp of when the check was performed */
  checkedAt: string;
}

/** Normalise a UK number to the 11-digit national format expected by the TPS API, e.g. "07700900000" */
function normaliseUkNumber(raw: string): string {
  let n = raw.replace(/[\s\-().+]/g, '');
  // +44XXXXXXXXXX → 0XXXXXXXXXX
  if (n.startsWith('44')) n = '0' + n.slice(2);
  return n;
}

const DEFAULT_TPS_API_URL = 'https://api.tpsonline.org.uk';

/**
 * Check a single UK phone number against TPS and CTPS.
 *
 * Returns `{ status: 'unchecked', checked: false }` when no API key is configured
 * so callers can decide whether to block or warn.
 */
export async function checkTps(rawPhone: string): Promise<TpsResult> {
  const apiKey = process.env.TPS_API_KEY;
  const baseUrl = (process.env.TPS_API_URL ?? DEFAULT_TPS_API_URL).replace(/\/$/, '');
  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    console.warn('[TPS] TPS_API_KEY is not set — skipping TPS check');
    return { status: 'unchecked', checked: false, checkedAt };
  }

  const phone = normaliseUkNumber(rawPhone);

  try {
    // --- TPS check ---
    const tpsRes = await fetch(`${baseUrl}/api/tps/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phoneNumber: phone }),
      signal: AbortSignal.timeout(8000),
    });

    if (!tpsRes.ok) {
      const text = await tpsRes.text();
      console.error(`[TPS] API error ${tpsRes.status}: ${text}`);
      return { status: 'unchecked', checked: false, checkedAt };
    }

    const tpsData = await tpsRes.json() as { registered?: boolean; status?: string };
    const tpsRegistered = tpsData.registered === true || tpsData.status === 'Registered';

    // --- CTPS check ---
    const ctpsRes = await fetch(`${baseUrl}/api/ctps/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phoneNumber: phone }),
      signal: AbortSignal.timeout(8000),
    });

    let ctpsRegistered = false;
    if (ctpsRes.ok) {
      const ctpsData = await ctpsRes.json() as { registered?: boolean; status?: string };
      ctpsRegistered = ctpsData.registered === true || ctpsData.status === 'Registered';
    }

    let status: TpsStatus = 'clean';
    if (tpsRegistered && ctpsRegistered) status = 'tps_and_ctps';
    else if (tpsRegistered) status = 'tps';
    else if (ctpsRegistered) status = 'ctps';

    return { status, checked: true, checkedAt };
  } catch (err) {
    console.error('[TPS] Network error during TPS check:', err);
    return { status: 'unchecked', checked: false, checkedAt };
  }
}

/** Returns true if the status means calling is prohibited. */
export function isTpsBlocked(status: TpsStatus): boolean {
  return status === 'tps' || status === 'ctps' || status === 'tps_and_ctps';
}

/** Human-readable label for a TPS status. */
export function tpsStatusLabel(status: TpsStatus): string {
  switch (status) {
    case 'tps':         return 'TPS registered';
    case 'ctps':        return 'CTPS registered';
    case 'tps_and_ctps':return 'TPS & CTPS registered';
    case 'clean':       return 'Not TPS registered';
    case 'unchecked':   return 'TPS not checked';
  }
}
