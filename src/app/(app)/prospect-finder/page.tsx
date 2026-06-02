'use client';
import { useState, useCallback } from 'react';
import type { WebsiteAnalysis } from '@/lib/prospect-scorer';

// ─── Google Places (via server proxy) ───────────────────────────────────────
const SEGMENT_QUERIES: Record<string, string> = {
  electrician: 'electricians',
  plumber:     'plumbers',
  builder:     'builders',
  accountant:  'accountants',
  consultant:  'business consultants',
  solicitor:   'solicitors',
  garage:      'car garages',
  restaurant:  'restaurants',
  cleaner:     'cleaning services',
  landscaper:  'landscapers',
  dentist:     'dentists',
  optician:    'opticians',
};

const LOCATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  Leicester:  { latitude: 52.6369, longitude: -1.1398 },
  Birmingham: { latitude: 52.4862, longitude: -1.8904 },
  London:     { latitude: 51.5074, longitude: -0.1278 },
  Coventry:   { latitude: 52.4068, longitude: -1.5197 },
  Derby:      { latitude: 52.9225, longitude: -1.4746 },
  Nottingham: { latitude: 52.9548, longitude: -1.1581 },
  Manchester: { latitude: 53.4808, longitude: -2.2426 },
  Leeds:      { latitude: 53.8008, longitude: -1.5491 },
  Sheffield:  { latitude: 53.3811, longitude: -1.4701 },
  Bristol:    { latitude: 51.4545, longitude: -2.5879 },
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

async function placesSearch(textQuery: string, location: string): Promise<GooglePlace[]> {
  const coords = LOCATION_COORDS[location];
  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: 20,
    languageCode: 'en-GB',
    regionCode: 'GB',
  };
  if (coords && location !== 'UK-wide') {
    body.locationBias = { circle: { center: coords, radius: 30_000 } };
  }
  const res = await fetch('/api/prospect-finder/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 503) throw new Error('not_configured');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = res.status;
    if (status === 403) throw new Error('forbidden_403');
    throw new Error(err?.error ?? `Places API error ${status}`);
  }
  const data = await res.json();
  return (data.places ?? []) as GooglePlace[];
}

async function searchPlaces(segment: string, location: string): Promise<SearchResult[]> {
  const searchTerm = SEGMENT_QUERIES[segment] ?? segment;
  const query = location === 'UK-wide' ? searchTerm : `${searchTerm} in ${location}`;
  const places = await placesSearch(query, location);
  return places
    .filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map(p => ({
      placeId:       p.id,
      name:          p.displayName?.text ?? 'Unknown',
      address:       p.formattedAddress ?? '',
      phone:         p.nationalPhoneNumber ?? null,
      website:       p.websiteUri ?? null,
      googleRating:  p.rating ?? null,
      ratingCount:   p.userRatingCount ?? 0,
      analysis:      null,
      analysisState: 'pending' as const,
      pushState:     'idle' as const,
    }));
}

// ─── Config ────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { key: 'electrician', label: 'Electrician' },
  { key: 'plumber',     label: 'Plumber'     },
  { key: 'builder',     label: 'Builder'     },
  { key: 'accountant',  label: 'Accountant'  },
  { key: 'consultant',  label: 'Consultant'  },
  { key: 'solicitor',   label: 'Solicitor'   },
  { key: 'garage',      label: 'Garage'      },
  { key: 'restaurant',  label: 'Restaurant'  },
  { key: 'cleaner',     label: 'Cleaner'     },
  { key: 'landscaper',  label: 'Landscaper'  },
  { key: 'dentist',     label: 'Dentist'     },
  { key: 'optician',    label: 'Optician'    },
];

const LOCATIONS = [
  'Leicester', 'Birmingham', 'London', 'Coventry',
  'Derby', 'Nottingham', 'Manchester', 'Leeds', 'Sheffield', 'Bristol', 'UK-wide',
];

// ─── Types ──────────────────────────────────────────────────────────────────
interface SearchResult {
  placeId:      string;
  name:         string;
  address:      string;
  phone:        string | null;
  website:      string | null;
  googleRating: number | null;
  ratingCount:  number;
  analysis:     WebsiteAnalysis | null;
  analysisState: 'pending' | 'loading' | 'done';
  pushState:    'idle' | 'pushing' | 'done' | 'exists';
}

// ─── Score badge ────────────────────────────────────────────────────────────
function ScoreBadge({ analysis }: { analysis: WebsiteAnalysis | null; state: string }) {
  if (!analysis) {
    return <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs bg-slate-800 text-slate-600 animate-pulse">…</span>;
  }
  const { opportunityScore, opportunityLabel } = analysis;
  const cls =
    opportunityLabel === 'hot'  ? 'bg-red-900 text-red-200'    :
    opportunityLabel === 'warm' ? 'bg-amber-900 text-amber-200' :
                                  'bg-slate-800 text-slate-400';
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold ${cls}`}>
      {opportunityScore}
    </span>
  );
}

function LabelPill({ label }: { label: 'hot' | 'warm' | 'low' }) {
  const cls =
    label === 'hot'  ? 'bg-red-900/50 text-red-300'    :
    label === 'warm' ? 'bg-amber-900/50 text-amber-300' :
                       'bg-slate-800 text-slate-500';
  const text = label === 'hot' ? '🔥 Hot' : label === 'warm' ? '~ Warm' : '· Low';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cls}`}>{text}</span>;
}

// ─── Push-to-Prospects button ────────────────────────────────────────────────
function PushButton({
  result,
  segment,
  onDone,
}: {
  result: SearchResult;
  segment: string;
  onDone: (placeId: string, state: 'done' | 'exists') => void;
}) {
  const [state, setState] = useState<'idle' | 'pushing' | 'done' | 'exists'>(result.pushState);

  async function push() {
    setState('pushing');
    // Derive a short location from address
    const addressParts = result.address.split(',');
    const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2].trim() : null;
    const postcode = addressParts[addressParts.length - 1]?.trim() ?? null;

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: result.name,
        website:      result.analysis?.url ?? result.website ?? null,
        phone:        result.phone,
        location:     city,
        postcode,
        source:       'other',
        stage:        'prospect',
        status:       'new',
        lead_score:   result.analysis?.opportunityScore ?? 0,
        notes:        result.analysis?.reasons.join(' · ') ?? null,
      }),
    });

    const next = res.status === 409 ? 'exists' : res.ok ? 'done' : 'idle';
    setState(next as 'idle' | 'done' | 'exists');
    if (next !== 'idle') onDone(result.placeId, next as 'done' | 'exists');
  }

  if (state === 'done')   return <span className="text-xs text-emerald-400 font-medium">✓ Added</span>;
  if (state === 'exists') return <span className="text-xs text-amber-400 font-medium">Already exists</span>;

  return (
    <button
      onClick={push}
      disabled={state === 'pushing'}
      className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
    >
      {state === 'pushing' ? 'Saving…' : '+ Prospect'}
    </button>
  );
}

// ─── V2 Industrial Sector Search ─────────────────────────────────────────────
const V2_SEGMENTS = [
  { key: 'manufacturing',  label: 'Manufacturing',              query: 'manufacturing companies'          },
  { key: 'engineering',    label: 'Engineering',                query: 'engineering companies'            },
  { key: 'logistics',      label: 'Logistics & Warehousing',    query: 'logistics warehousing companies'  },
  { key: 'food_prod',      label: 'Food Production',            query: 'food production manufacturers'    },
  { key: 'tooling',        label: 'Tooling & Precision Eng.',   query: 'precision engineering tooling'    },
  { key: 'metal_fab',      label: 'Metal Fabrication',          query: 'metal fabrication companies'      },
  { key: 'cnc',            label: 'CNC Machining',              query: 'cnc machining companies'          },
  { key: 'automation',     label: 'Industrial Automation',      query: 'industrial automation companies'  },
  { key: 'packaging',      label: 'Packaging Companies',        query: 'industrial packaging companies'   },
  { key: 'electronics',    label: 'Electronics Manufacturing',  query: 'electronics manufacturing'        },
];

// V2 scoring: sector base + website signals
function computeV2Score(sectorKey: string, analysis: WebsiteAnalysis | null): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20; // base for being in an industrial sector

  const sectorLabel = V2_SEGMENTS.find(s => s.key === sectorKey)?.label ?? sectorKey;
  reasons.push(`${sectorLabel} sector (+20)`);

  if (!analysis) return { score, reasons };

  if (analysis.status === 'no_website') {
    score += 35; reasons.push('No website (+35)');
    return { score, reasons };
  }
  if (analysis.status === 'unreachable') {
    score += 30; reasons.push('Broken/unreachable site (+30)');
    return { score, reasons };
  }
  if (!analysis.hasSsl)            { score += 15; reasons.push('No SSL (+15)'); }
  if (!analysis.isMobileFriendly)  { score += 15; reasons.push('Not mobile-friendly (+15)'); }
  if (!analysis.hasContactForm)    { score += 10; reasons.push('No contact form (+10)'); }
  if (analysis.isSlowLoading)      { score += 10; reasons.push('Slow loading (+10)'); }
  if (!analysis.hasCrmKeywords)    { score += 20; reasons.push('No CRM detected (+20)'); }
  if (analysis.hasProductionKeywords) { score += 10; reasons.push('Industrial keywords confirmed (+10)'); }

  return { score, reasons };
}

function v2ScoreLabel(score: number): 'hot' | 'warm' | 'low' {
  if (score >= 65) return 'hot';
  if (score >= 40) return 'warm';
  return 'low';
}

interface V2Result extends SearchResult {
  v2Score: number;
  v2Reasons: string[];
}

function V2ScoreBadge({ score, state }: { score: number; state: string }) {
  if (state !== 'done') {
    return <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs bg-slate-800 text-slate-600 animate-pulse">…</span>;
  }
  const label = v2ScoreLabel(score);
  const cls =
    label === 'hot'  ? 'bg-red-900 text-red-200' :
    label === 'warm' ? 'bg-amber-900 text-amber-200' :
                       'bg-slate-800 text-slate-400';
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold ${cls}`}>
      {score}
    </span>
  );
}

function V2PushButton({ result, sector, onDone }: {
  result: V2Result;
  sector: string;
  onDone: (placeId: string, state: 'done' | 'exists') => void;
}) {
  const [state, setState] = useState<'idle' | 'pushing' | 'done' | 'exists'>(result.pushState);

  async function push() {
    setState('pushing');
    const parts = result.address.split(',');
    const city = parts.length >= 2 ? parts[parts.length - 2].trim() : null;
    const postcode = parts[parts.length - 1]?.trim() ?? null;
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: result.name,
        website:      result.analysis?.url ?? result.website ?? null,
        phone:        result.phone,
        location:     city,
        postcode,
        source:       'other',
        stage:        'prospect',
        status:       'new',
        lead_score:   result.v2Score,
        notes:        result.v2Reasons.join(' · ') || null,
      }),
    });
    const next = res.status === 409 ? 'exists' : res.ok ? 'done' : 'idle';
    setState(next as 'idle' | 'done' | 'exists');
    if (next !== 'idle') onDone(result.placeId, next as 'done' | 'exists');
  }

  if (state === 'done')   return <span className="text-xs text-emerald-400 font-medium">✓ Added</span>;
  if (state === 'exists') return <span className="text-xs text-amber-400 font-medium">Already exists</span>;
  return (
    <button onClick={push} disabled={state === 'pushing'}
      className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
      {state === 'pushing' ? 'Saving…' : '+ Prospect'}
    </button>
  );
}

function V2ScorerTab() {
  const [sector,   setSector]   = useState('manufacturing');
  const [location, setLocation] = useState('Leicester');
  const [results,  setResults]  = useState<V2Result[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [notConfigured, setNotConfigured] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'name'>('score');

  const analyseOne = useCallback(async (placeId: string, url: string | null, sectorKey: string) => {
    const res = await fetch(`/api/prospect-finder/analyse?url=${encodeURIComponent(url ?? '')}`);
    if (!res.ok) return;
    const analysis: WebsiteAnalysis = await res.json();
    const { score, reasons } = computeV2Score(sectorKey, analysis);
    setResults(prev =>
      prev.map(r =>
        r.placeId === placeId
          ? { ...r, analysis, analysisState: 'done', v2Score: score, v2Reasons: reasons }
          : r,
      ),
    );
  }, []);

  const search = useCallback(async () => {
    setLoading(true); setError(''); setNotConfigured(false); setResults([]);

    const seg = V2_SEGMENTS.find(s => s.key === sector)!;
    const query = location === 'UK-wide' ? seg.query : `${seg.query} in ${location}`;

    let initial: V2Result[];
    try {
      const places = await placesSearch(query, location);
      initial = places
        .filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY')
        .map(p => {
          const { score, reasons } = computeV2Score(sector, null);
          return {
            placeId: p.id, name: p.displayName?.text ?? 'Unknown',
            address: p.formattedAddress ?? '', phone: p.nationalPhoneNumber ?? null,
            website: p.websiteUri ?? null, googleRating: p.rating ?? null,
            ratingCount: p.userRatingCount ?? 0, analysis: null,
            analysisState: 'pending' as const, pushState: 'idle' as const,
            v2Score: score, v2Reasons: reasons,
          };
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      if (msg === 'not_configured') { setNotConfigured(true); setLoading(false); return; }
      if (msg === 'forbidden_403')  { setError('403 Forbidden — check: 1) Places API (New) is enabled in Google Cloud Console, 2) Billing is active, 3) GOOGLE_PLACES_API_KEY is set in .env.local on the Pi.'); setLoading(false); return; }
      setError(msg);
      setLoading(false); return;
    }

    setResults(initial);
    setLoading(false);

    for (const r of initial) {
      setResults(prev => prev.map(x => x.placeId === r.placeId ? { ...x, analysisState: 'loading' } : x));
      await analyseOne(r.placeId, r.website, sector);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }, [sector, location, analyseOne]);

  const handlePushDone = useCallback((placeId: string, state: 'done' | 'exists') => {
    setResults(prev => prev.map(r => r.placeId === placeId ? { ...r, pushState: state } : r));
  }, []);

  const displayed = [...results].sort((a, b) => {
    if (sortBy === 'score')  return b.v2Score - a.v2Score;
    if (sortBy === 'rating') return (b.googleRating ?? 0) - (a.googleRating ?? 0);
    return a.name.localeCompare(b.name);
  });

  const hotCount      = results.filter(r => r.analysisState === 'done' && v2ScoreLabel(r.v2Score) === 'hot').length;
  const warmCount     = results.filter(r => r.analysisState === 'done' && v2ScoreLabel(r.v2Score) === 'warm').length;
  const analysedCount = results.filter(r => r.analysisState === 'done').length;

  return (
    <div className="space-y-5">
      {/* Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Industrial Sector</div>
          <div className="flex flex-wrap gap-1.5">
            {V2_SEGMENTS.map(s => (
              <button key={s.key} onClick={() => setSector(s.key)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  sector === s.key ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</div>
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map(loc => (
              <button key={loc} onClick={() => setLocation(loc)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  location === loc ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}>{loc}</button>
            ))}
          </div>
        </div>
        <button onClick={search} disabled={loading}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors">
          {loading ? 'Searching…' : '✦ Find Industrial Prospects'}
        </button>
      </div>

      {notConfigured && (
        <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 text-sm text-amber-300">
          ⚠ Google Places API key not configured — add <span className="font-mono">GOOGLE_PLACES_API_KEY</span> to <span className="font-mono">.env.local</span> on the Pi and restart PM2.
        </div>
      )}
      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-slate-400">
              <span className="text-slate-100 font-semibold">{results.length}</span> companies found
              {analysedCount < results.length && <span className="text-slate-600"> · scoring {analysedCount}/{results.length}…</span>}
            </span>
            {analysedCount === results.length && results.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300 font-semibold">{hotCount} hot</span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-amber-300 font-semibold">{warmCount} warm</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Sort:</span>
            {(['score', 'rating', 'name'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${
                  sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {s === 'score' ? 'V2 Score' : s === 'rating' ? 'Google Rating' : 'Name'}
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-center w-12">Score</th>
                    <th className="px-3 py-3 text-left">Company</th>
                    <th className="px-3 py-3 text-left">Contact</th>
                    <th className="px-3 py-3 text-left">Google</th>
                    <th className="px-3 py-3 text-left">Website Signals</th>
                    <th className="px-3 py-3 text-left">Score Breakdown</th>
                    <th className="px-3 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(r => {
                    const label = r.analysisState === 'done' ? v2ScoreLabel(r.v2Score) : null;
                    return (
                      <tr key={r.placeId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-3 text-center">
                          <V2ScoreBadge score={r.v2Score} state={r.analysisState} />
                          {label && (
                            <div className="mt-1 flex justify-center">
                              <LabelPill label={label} />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 max-w-[200px]">
                          <div className="font-medium text-slate-100 text-sm leading-snug">{r.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-snug">{r.address}</div>
                        </td>
                        <td className="px-3 py-3">
                          {r.phone && <a href={`tel:${r.phone}`} className="text-xs text-slate-300 hover:text-white block">{r.phone}</a>}
                          {r.website ? (
                            <a href={r.website} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 block truncate max-w-[160px] mt-0.5">
                              {r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                          ) : r.analysisState !== 'done' ? (
                            <span className="text-xs text-slate-600">checking…</span>
                          ) : (
                            <span className="text-xs text-slate-600">No website</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {r.googleRating ? (
                            <div>
                              <span className="text-sm font-semibold text-amber-400">★ {r.googleRating.toFixed(1)}</span>
                              <div className="text-[10px] text-slate-600">{r.ratingCount} reviews</div>
                            </div>
                          ) : <span className="text-xs text-slate-600">No rating</span>}
                        </td>
                        <td className="px-3 py-3">
                          {r.analysisState !== 'done' ? (
                            <div className="text-xs text-slate-600 animate-pulse">
                              {r.analysisState === 'loading' ? 'Scoring…' : 'Pending…'}
                            </div>
                          ) : r.analysis?.status === 'no_website' ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 font-medium">No website</span>
                          ) : r.analysis?.status === 'unreachable' ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 font-medium">Broken site</span>
                          ) : r.analysis ? (
                            <div className="space-y-0.5">
                              <Check label="SSL"        pass={r.analysis.hasSsl} />
                              <Check label="Mobile"     pass={r.analysis.isMobileFriendly} />
                              <Check label="Contact"    pass={r.analysis.hasContactForm} />
                              <Check label="No CRM"     pass={!r.analysis.hasCrmKeywords} />
                              <Check label="Industrial" pass={r.analysis.hasProductionKeywords} />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 max-w-[200px]">
                          {r.analysisState === 'done' && (
                            <div className="space-y-0.5">
                              {r.v2Reasons.map((reason, i) => (
                                <div key={i} className="text-xs text-slate-400 leading-snug">· {reason}</div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <V2PushButton result={r} sector={sector} onDone={handlePushDone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !notConfigured && !error && results.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <div className="text-4xl mb-3">✦</div>
          <p className="text-slate-400 font-medium">Select an industrial sector and location, then search</p>
          <p className="text-slate-600 text-sm mt-1">Companies are scored on sector fit + website quality + CRM signals</p>
          <div className="mt-4 flex justify-center gap-6 text-xs">
            <span className="text-red-300 font-semibold">🔥 Hot: 65+</span>
            <span className="text-amber-300 font-semibold">~ Warm: 40–64</span>
            <span className="text-slate-500">· Low: below 40</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function ProspectFinderPage() {
  const [activeTab, setActiveTab] = useState<'v1' | 'v2'>('v1');
  const [segment,  setSegment]  = useState('electrician');
  const [location, setLocation] = useState('Leicester');
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [notConfigured, setNotConfigured] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'name'>('score');
  const [filterLabel, setFilterLabel] = useState<'all' | 'hot' | 'warm' | 'low'>('all');

  // Analyse a single result's website
  const analyseOne = useCallback(async (placeId: string, url: string | null) => {
    const res = await fetch(`/api/prospect-finder/analyse?url=${encodeURIComponent(url ?? '')}`);
    if (!res.ok) return;
    const analysis: WebsiteAnalysis = await res.json();
    setResults(prev =>
      prev.map(r =>
        r.placeId === placeId
          ? { ...r, analysis, analysisState: 'done' }
          : r,
      ),
    );
  }, []);

  // Search and then auto-analyse each result sequentially
  const search = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotConfigured(false);
    setResults([]);

    let initial: SearchResult[];
    try {
      initial = await searchPlaces(segment, location);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      if (msg === 'not_configured') { setNotConfigured(true); setLoading(false); return; }
      if (msg === 'forbidden_403')  { setError('403 Forbidden — check: 1) Places API (New) is enabled in Google Cloud Console, 2) Billing is active, 3) API key has no IP/referrer restrictions blocking the server.'); setLoading(false); return; }
      setError(msg);
      setLoading(false);
      return;
    }

    setResults(initial);
    setLoading(false);

    // Analyse each sequentially so we don't slam the server
    for (const r of initial) {
      setResults(prev =>
        prev.map(x => x.placeId === r.placeId ? { ...x, analysisState: 'loading' } : x),
      );
      await analyseOne(r.placeId, r.website);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }, [segment, location, analyseOne]);

  const handlePushDone = useCallback((placeId: string, state: 'done' | 'exists') => {
    setResults(prev => prev.map(r => r.placeId === placeId ? { ...r, pushState: state } : r));
  }, []);

  // Filtered + sorted results
  const displayed = results
    .filter(r => {
      if (filterLabel === 'all') return true;
      if (!r.analysis) return true;
      return r.analysis.opportunityLabel === filterLabel;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        const sa = a.analysis?.opportunityScore ?? -1;
        const sb = b.analysis?.opportunityScore ?? -1;
        return sb - sa;
      }
      if (sortBy === 'rating') return (b.googleRating ?? 0) - (a.googleRating ?? 0);
      return a.name.localeCompare(b.name);
    });

  const hotCount  = results.filter(r => r.analysis?.opportunityLabel === 'hot').length;
  const warmCount = results.filter(r => r.analysis?.opportunityLabel === 'warm').length;
  const analysedCount = results.filter(r => r.analysisState === 'done').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">Prospect Finder</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-900 text-violet-300 uppercase tracking-wider">
              Internal
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Find businesses by segment &amp; location — score their websites — push hot prospects to CRM
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('v1')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'v1' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⊙ Finder V1 <span className="text-[10px] ml-1 opacity-60">Google Places</span>
        </button>
        <button
          onClick={() => setActiveTab('v2')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'v2' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✦ Scorer V2 <span className="text-[10px] ml-1 opacity-60">Attribute-based</span>
        </button>
      </div>

      {activeTab === 'v2' && <V2ScorerTab />}

      {activeTab === 'v1' && (<>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {/* Segment */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Business Type</div>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => (
              <button
                key={s.key}
                onClick={() => setSegment(s.key)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  segment === s.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</div>
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map(loc => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  location === loc
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={search}
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : '⊙ Find Prospects'}
        </button>
      </div>

      {/* API key not configured */}
      {notConfigured && (
        <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-5 space-y-3">
          <div className="text-amber-300 font-semibold text-sm">⚠ Google Places API Key Required</div>
          <p className="text-sm text-slate-400">
            This feature needs a Google Places API key to search for businesses.
          </p>
          <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
            <li>Go to <span className="font-mono text-slate-300">console.cloud.google.com</span> → APIs &amp; Services → Credentials</li>
            <li>Create an API key and enable <strong className="text-slate-200">Places API (New)</strong></li>
            <li>On the Pi, open <span className="font-mono text-slate-300">.env.local</span> in the project root</li>
            <li>Add: <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded">GOOGLE_PLACES_API_KEY=your_key_here</span></li>
            <li>Restart: <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded">pm2 restart splendid-crm</span></li>
          </ol>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-slate-400">
              <span className="text-slate-100 font-semibold">{results.length}</span> businesses found
              {analysedCount < results.length && (
                <span className="text-slate-600"> · analysing {analysedCount}/{results.length}…</span>
              )}
            </span>
            {analysedCount === results.length && results.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300 font-semibold">{hotCount} hot</span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-amber-300 font-semibold">{warmCount} warm</span>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Sort:</span>
              {(['score', 'rating', 'name'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s === 'score' ? 'Opportunity' : s === 'rating' ? 'Google Rating' : 'Name'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Filter:</span>
              {(['all', 'hot', 'warm', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterLabel(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    filterLabel === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'hot' ? '🔥 Hot' : f === 'warm' ? 'Warm' : 'Low'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-center w-12">Score</th>
                    <th className="px-3 py-3 text-left">Business</th>
                    <th className="px-3 py-3 text-left">Contact</th>
                    <th className="px-3 py-3 text-left">Google</th>
                    <th className="px-3 py-3 text-left">Website Checks</th>
                    <th className="px-3 py-3 text-left">Why Contact</th>
                    <th className="px-3 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(r => (
                    <tr key={r.placeId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                      {/* Score */}
                      <td className="px-3 py-3 text-center">
                        <ScoreBadge analysis={r.analysis} state={r.analysisState} />
                        {r.analysis && (
                          <div className="mt-1 flex justify-center">
                            <LabelPill label={r.analysis.opportunityLabel} />
                          </div>
                        )}
                      </td>

                      {/* Business */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="font-medium text-slate-100 text-sm leading-snug">{r.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">{r.address}</div>
                      </td>

                      {/* Contact */}
                      <td className="px-3 py-3">
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="text-xs text-slate-300 hover:text-white block">
                            {r.phone}
                          </a>
                        )}
                        {r.analysis?.url ? (
                          <a
                            href={r.analysis.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 block truncate max-w-[180px] mt-0.5"
                          >
                            {r.analysis.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        ) : r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 block truncate max-w-[180px] mt-0.5"
                          >
                            {r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        ) : r.analysisState !== 'done' ? (
                          <span className="text-xs text-slate-600">checking…</span>
                        ) : (
                          <span className="text-xs text-slate-600">No website</span>
                        )}
                      </td>

                      {/* Google rating */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.googleRating ? (
                          <div>
                            <span className="text-sm font-semibold text-amber-400">★ {r.googleRating.toFixed(1)}</span>
                            <div className="text-[10px] text-slate-600">{r.ratingCount} reviews</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">No rating</span>
                        )}
                      </td>

                      {/* Website checks */}
                      <td className="px-3 py-3">
                        {r.analysisState !== 'done' ? (
                          <div className="text-xs text-slate-600 animate-pulse">
                            {r.analysisState === 'loading' ? 'Checking…' : 'Pending…'}
                          </div>
                        ) : r.analysis?.status === 'no_website' ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 font-medium">No website</span>
                        ) : r.analysis?.status === 'unreachable' ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 font-medium">Broken site</span>
                        ) : (
                          <div className="space-y-0.5">
                            <Check label="SSL"           pass={r.analysis?.hasSsl ?? false} />
                            <Check label="Mobile"        pass={r.analysis?.isMobileFriendly ?? false} />
                            <Check label="Contact form"  pass={r.analysis?.hasContactForm ?? false} />
                            <Check label="Fast loading"  pass={!(r.analysis?.isSlowLoading ?? false)} />
                          </div>
                        )}
                      </td>

                      {/* Why contact */}
                      <td className="px-3 py-3 max-w-[200px]">
                        {r.analysisState === 'done' && r.analysis ? (
                          r.analysis.reasons[0] === 'Website looks good' ? (
                            <span className="text-xs text-slate-600 italic">Looks good already</span>
                          ) : (
                            <div className="space-y-0.5">
                              {r.analysis.reasons.map((reason, i) => (
                                <div key={i} className="text-xs text-slate-400 leading-snug">
                                  · {reason}
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3">
                        <PushButton result={r} segment={segment} onDone={handlePushDone} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state after search */}
      {!loading && !notConfigured && !error && results.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <div className="text-4xl mb-3">⊙</div>
          <p className="text-slate-400 font-medium">Select a business type and location, then search</p>
          <p className="text-slate-600 text-sm mt-1">Results will show website quality scores and contact reasons</p>
        </div>
      )}
      </>)}
    </div>
  );
}

// ─── Small check indicator ──────────────────────────────────────────────────
function Check({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[11px] ${pass ? 'text-emerald-500' : 'text-red-500'}`}>
        {pass ? '✓' : '✗'}
      </span>
      <span className={`text-[11px] ${pass ? 'text-slate-500' : 'text-slate-300'}`}>{label}</span>
    </div>
  );
}
