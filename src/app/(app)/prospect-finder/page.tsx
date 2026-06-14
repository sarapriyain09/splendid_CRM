'use client';
import { useState, useCallback } from 'react';
import type { WebsiteAnalysis } from '@/lib/prospect-scorer';
import { getSicDescription } from '@/lib/sic-codes';
import { computeEngScore, engGradeColor, type EngSector, type LinkedInHiring, type GrowthSignal, type DecisionMakerRole, type LinkedInEngagement } from '@/lib/eng-scorer';

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
        vertical:     'software',
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
        vertical:     'engineering',
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

// ─── CH Engineering (Companies House) Tab ───────────────────────────────────
const ENG_SIC_GROUPS = [
  {
    key: 'all_eng', label: 'All Engineering',
    codes: ['25110','25120','25290','25300','25500','25610','25620','25710','25720','25730','25910','25920','25930','25940','25990','28110','28120','28130','28140','28150','28210','28220','28240','28250','28290','28300','28410','28490','28910','28920','28930','28940','28950','28960','28990','29100','29200','29310','29320','30300','30400','33110','33120','33130','33140','33190','33200'],
  },
  { key: 'sheet_metal', label: 'Sheet Metal & Fabrication', codes: ['25110','25120','25290','25300','25500','25610','25620','25710','25720','25730','25910','25920','25930','25940','25990'] },
  { key: 'machinery',   label: 'Special Purpose Machinery',  codes: ['28110','28120','28130','28140','28150','28210','28220','28240','28250','28290','28300','28410','28490','28910','28920','28930','28940','28950','28960','28990'] },
  { key: 'automotive',  label: 'Automotive Suppliers',       codes: ['29100','29200','29310','29320'] },
  { key: 'aerospace',   label: 'Aerospace & Defence',        codes: ['30300','30400'] },
  { key: 'repair',      label: 'Repair & Installation',      codes: ['33110','33120','33130','33140','33190','33200'] },
];

const CH_ENG_LOCATIONS = ['Leicester','Coventry','Birmingham','Derby','Nottingham','Sheffield','Peterborough'];

interface CHResult {
  company_name: string;
  company_number: string;
  date_of_creation: string;
  registered_office_address: { address_line_1?: string; locality?: string; postal_code?: string };
  sic_codes: string[];
  officers: Array<{ name: string; officer_role: string }> | null;
  officersState: 'idle' | 'loading' | 'done';
  pushState: 'idle' | 'pushing' | 'done' | 'exists';
  // auto-detected signals
  empCount: number | null;
  website: string | null;
  emails: string[];
  hiringSignal: LinkedInHiring;
  growthSignal: GrowthSignal;
  decisionMakerRole: DecisionMakerRole;
  engagement: LinkedInEngagement;
  autoScoreState: 'idle' | 'loading' | 'done';
}

const liCompanyUrl = (name: string) =>
  `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;
const liPersonUrl = (personName: string, companyName: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${personName} ${companyName}`)}`;

const LiIcon = () => (
  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

function sicToSector(sics: string[]): EngSector {
  for (const s of sics) {
    if (['30300','30400'].includes(s))                  return 'aerospace';
    if (['29100','29200','29310','29320'].includes(s))  return 'automotive';
    if (s === '28290')                                 return 'special_purpose';
    if (s.startsWith('28'))                            return 'machinery_automation';
    if (s.startsWith('25') || s.startsWith('33'))      return 'fabrication';
    if (s.startsWith('26'))                            return 'electronics';
    if (s.startsWith('27') || s.startsWith('32'))      return 'industrial_equipment';
  }
  return 'other';
}

function CHPushButton({ result, engScore, engGrade, onDone }: {
  result: CHResult;
  engScore: number;
  engGrade: string;
  onDone: (num: string, state: 'done' | 'exists') => void;
}) {
  const [state,    setState]    = useState<'idle' | 'pushing' | 'done' | 'exists'>(result.pushState);

  async function push() {
    setState('pushing');
    const addr = result.registered_office_address;
    const sector = sicToSector(result.sic_codes);
    const firstOfficer = result.officers?.[0] ?? null;
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name:      result.company_name,
        company_number:    result.company_number,
        location:          addr.locality ?? null,
        postcode:          addr.postal_code ?? null,
        website:           result.website ?? null,
        email:             result.emails[0] ?? null,
        contact_name:      firstOfficer ? firstOfficer.name : null,
        linkedin_url:      `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(result.company_name)}`,
        source:            'companies_house',
        stage:             'prospect',
        status:            'new',
        vertical:          'engineering',
        lead_score:        engScore,
        eng_score:         engScore,
        eng_grade:         engGrade,
        employee_count:    result.empCount ?? null,
        eng_sector:        sector || null,
        linkedin_hiring:   result.hiringSignal !== 'none' ? result.hiringSignal : null,
        decision_maker_role: result.decisionMakerRole !== 'none' ? result.decisionMakerRole : null,
        growth_signal:     result.growthSignal !== 'none' ? result.growthSignal : null,
        linkedin_engagement: result.engagement !== 'none' ? result.engagement : null,
        notes:             `CH #${result.company_number} · SIC: ${result.sic_codes.join(', ')} · Eng Score: ${engScore}/100 (${engGrade})`,
      }),
    });
    const next = res.status === 409 ? 'exists' : res.ok ? 'done' : 'idle';
    setState(next as 'idle' | 'done' | 'exists');
    if (next !== 'idle') onDone(result.company_number, next as 'done' | 'exists');
  }

  if (state === 'done')   return <span className="text-xs text-emerald-400 font-medium">✓ Added</span>;
  if (state === 'exists') return <span className="text-xs text-amber-400 font-medium">Already exists</span>;
  return (
    <div className="flex flex-col gap-1">
      <button onClick={push} disabled={state === 'pushing'}
        className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
        {state === 'pushing' ? 'Saving…' : '+ Prospect'}
      </button>
    </div>
  );
}

function CHEngineeringTab() {
  const [sicGroup,  setSicGroup]  = useState('all_eng');
  const [locations, setLocations] = useState<string[]>(['Leicester']);
  const [results,   setResults]   = useState<CHResult[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [totalHits, setTotalHits] = useState(0);
  const [sortBy,    setSortBy]    = useState<'score' | 'name'>('score');
  const [filterGrade, setFilterGrade] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');

  const updateEngagement = useCallback((companyNumber: string, val: LinkedInEngagement) => {
    setResults(prev => prev.map(r =>
      r.company_number === companyNumber ? { ...r, engagement: val } : r,
    ));
  }, []);

  // Auto-detect decision maker from CH officers
  const decisionMakerFromOfficers = (officers: Array<{ name: string; officer_role: string }> | null): DecisionMakerRole => {
    if (!officers || officers.length === 0) return 'none';
    for (const o of officers) {
      const role = o.officer_role.toLowerCase();
      if (role.includes('managing')) return 'md';
      if (role.includes('technical') || role.includes('engineer')) return 'tech_director';
    }
    // Any director = at least MD-level contact
    if (officers.some(o => o.officer_role.toLowerCase().includes('director'))) return 'md';
    return 'none';
  };

  const autoScore = useCallback(async (companyNumber: string, companyName: string) => {
    setResults(prev => prev.map(r =>
      r.company_number === companyNumber ? { ...r, autoScoreState: 'loading' } : r,
    ));

    let website: string | null = null;
    let emails: string[] = [];
    let hiringSignal: LinkedInHiring = 'none';
    let growthSignal: GrowthSignal = 'none';
    let empCount: number | null = null;

    // Step 1: find website
    try {
      const wsRes = await fetch(`/api/ch/check-website?company_name=${encodeURIComponent(companyName)}`);
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        website = wsData.url ?? null;
      }
    } catch { /* ignore */ }

    // Step 2: scrape company page for all signals
    if (website) {
      try {
        const scrapeRes = await fetch(`/api/ch/scrape-company?url=${encodeURIComponent(website)}`);
        if (scrapeRes.ok) {
          const d = await scrapeRes.json();
          emails        = d.emails        ?? [];
          empCount      = d.employeeCount ?? null;
          hiringSignal  = d.hiringSignal  ?? 'none';
          growthSignal  = d.growthSignal  ?? 'none';
        }
      } catch { /* ignore */ }
    }

    // Step 3: fall back to guessed emails if none found
    if (emails.length === 0) {
      try {
        const guessParams = website
          ? `website_url=${encodeURIComponent(website)}`
          : `company_name=${encodeURIComponent(companyName)}`;
        const guessRes = await fetch(`/api/ch/guess-email?${guessParams}`);
        if (guessRes.ok) {
          const guessData = await guessRes.json();
          emails = (guessData.emails ?? []).slice(0, 2).map((e: { address: string }) => e.address);
        }
      } catch { /* ignore */ }
    }

    setResults(prev => prev.map(r => {
      if (r.company_number !== companyNumber) return r;
      // Auto-derive decision maker from officers now that officers may be loaded
      const dm = decisionMakerFromOfficers(r.officers);
      return { ...r, website, emails, empCount, hiringSignal, growthSignal, decisionMakerRole: dm, autoScoreState: 'done' };
    }));
  }, []);

  const toggleLoc = (loc: string) =>
    setLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);

  const fetchOfficers = useCallback(async (companyNumber: string) => {
    try {
      const res = await fetch(`/api/ch/officers?company_number=${companyNumber}`);
      if (!res.ok) return;
      const data = await res.json();
      const officers: Array<{ name: string; officer_role: string }> = data.items ?? [];
      // Derive decision maker role from officers
      let dm: DecisionMakerRole = 'none';
      for (const o of officers) {
        const role = o.officer_role.toLowerCase();
        if (role.includes('managing')) { dm = 'md'; break; }
        if (role.includes('technical') || role.includes('engineer')) { dm = 'tech_director'; break; }
      }
      if (dm === 'none' && officers.some(o => o.officer_role.toLowerCase().includes('director'))) dm = 'md';
      setResults(prev =>
        prev.map(r =>
          r.company_number === companyNumber
            ? { ...r, officers, officersState: 'done', decisionMakerRole: r.decisionMakerRole !== 'none' ? r.decisionMakerRole : dm }
            : r,
        ),
      );
    } catch {
      setResults(prev =>
        prev.map(r =>
          r.company_number === companyNumber ? { ...r, officersState: 'done', officers: [] } : r,
        ),
      );
    }
  }, []);

  const search = useCallback(async () => {
    if (locations.length === 0) { setError('Select at least one location.'); return; }
    setLoading(true); setError(''); setResults([]); setTotalHits(0);

    const group = ENG_SIC_GROUPS.find(g => g.key === sicGroup)!;
    const params = new URLSearchParams({
      sic_codes: group.codes.join(','),
      locations:  locations.join(','),
    });

    try {
      const res = await fetch(`/api/ch/existing-companies?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string })?.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setTotalHits(data.hits ?? 0);

      const initial: CHResult[] = (data.leads ?? []).map((lead: {
        company: {
          company_name: string; company_number: string; date_of_creation: string;
          registered_office_address: CHResult['registered_office_address']; sic_codes: string[];
        };
      }) => ({
        company_name:              lead.company.company_name,
        company_number:            lead.company.company_number,
        date_of_creation:          lead.company.date_of_creation,
        registered_office_address: lead.company.registered_office_address,
        sic_codes:                 lead.company.sic_codes ?? [],
        officers:        null,
        officersState:   'idle' as const,
        pushState:       'idle' as const,
        empCount:        null,
        website:         null,
        emails:          [],
        hiringSignal:    'none' as const,
        growthSignal:    'none' as const,
        decisionMakerRole: 'none' as const,
        engagement:      'none' as const,
        autoScoreState:  'idle' as const,
      }));

      setResults(initial);
      setLoading(false);

      for (const r of initial) {
        setResults(prev =>
          prev.map(x => x.company_number === r.company_number ? { ...x, officersState: 'loading' } : x),
        );
        // Fetch officers + auto-score website in parallel
        await Promise.all([
          fetchOfficers(r.company_number),
          autoScore(r.company_number, r.company_name),
        ]);
        // After officers are loaded, update decision maker role
        setResults(prev => prev.map(x => {
          if (x.company_number !== r.company_number) return x;
          if (x.autoScoreState === 'done') return x; // already set in autoScore
          return x;
        }));
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setLoading(false);
    }
  }, [sicGroup, locations, fetchOfficers]);

  const handlePushDone = useCallback((num: string, state: 'done' | 'exists') => {
    setResults(prev => prev.map(r => r.company_number === num ? { ...r, pushState: state } : r));
  }, []);

  const displayed = [...results]
    .map(r => {
      const sector = sicToSector(r.sic_codes);
      // Re-derive decision maker from officers (may have loaded after autoScore ran)
      const dm: DecisionMakerRole = r.decisionMakerRole !== 'none'
        ? r.decisionMakerRole
        : (r.officers && r.officers.some(o => o.officer_role.toLowerCase().includes('director')) ? 'md' : 'none');
      const sr = computeEngScore({
        employee_count:      r.empCount,
        eng_sector:          sector,
        linkedin_hiring:     r.hiringSignal,
        decision_maker_role: dm,
        growth_signal:       r.growthSignal,
        linkedin_engagement: r.engagement,
      });
      return { ...r, _sector: sector, _score: sr.total, _grade: sr.grade, _dm: dm };
    })
    .filter(r => filterGrade === 'all' || r._grade === filterGrade)
    .sort((a, b) => sortBy === 'score' ? b._score - a._score : a.company_name.localeCompare(b.company_name));

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Engineering Sector (SIC Code Group)</div>
          <div className="flex flex-wrap gap-1.5">
            {ENG_SIC_GROUPS.map(g => (
              <button key={g.key} onClick={() => setSicGroup(g.key)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  sicGroup === g.key ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}>{g.label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Regions (multi-select)</div>
          <div className="flex flex-wrap gap-1.5">
            {CH_ENG_LOCATIONS.map(loc => (
              <button key={loc} onClick={() => toggleLoc(loc)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  locations.includes(loc) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}>{loc}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={search} disabled={loading || locations.length === 0}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors">
            {loading ? 'Searching CH…' : '⊡ Search Companies House'}
          </button>
          {totalHits > 0 && !loading && (
            <span className="text-xs text-slate-500">
              {totalHits.toLocaleString()} total · showing {displayed.length}/{results.length}
            </span>
          )}
        </div>
        {results.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap border-t border-slate-800 pt-4">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Sort:</span>
              {(['score','name'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                  }`}>{s === 'score' ? 'Eng Score' : 'Name'}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Grade:</span>
              {(['all','A','B','C','D'] as const).map(g => (
                <button key={g} onClick={() => setFilterGrade(g)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    filterGrade === g
                      ? g === 'A' ? 'bg-red-900 text-red-200'
                        : g === 'B' ? 'bg-amber-900 text-amber-200'
                        : g === 'C' ? 'bg-blue-900 text-blue-200'
                        : g === 'D' ? 'bg-slate-700 text-slate-400'
                        : 'bg-slate-700 text-slate-200'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>{g === 'all' ? 'All' : `Grade ${g}`}</button>
              ))}
            </div>
            <span className="text-[10px] text-slate-600">💡 Enter employee count per row to improve score</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {results.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 text-center w-20">Score</th>
                  <th className="px-3 py-3 text-left">Company</th>
                  <th className="px-3 py-3 text-left">Location</th>
                  <th className="px-3 py-3 text-left">SIC Codes</th>
                  <th className="px-3 py-3 text-left">Email / Website</th>
                  <th className="px-3 py-3 text-left">Directors &amp; LinkedIn</th>
                  <th className="px-3 py-3 text-left">Quick Links</th>
                  <th className="px-3 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => (
                  <tr key={r.company_number} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-3 text-center">
                      <div className={`text-xl font-bold leading-none ${engGradeColor(r._grade as 'A'|'B'|'C'|'D')}`}>
                        {r._score}<span className="text-[10px] text-slate-600 ml-0.5">/100</span>
                      </div>
                      <div className={`text-[10px] font-bold mt-0.5 ${
                        r._grade === 'A' ? 'text-red-400' : r._grade === 'B' ? 'text-amber-400' : r._grade === 'C' ? 'text-blue-400' : 'text-slate-500'
                      }`}>Grade {r._grade}</div>
                      {/* Auto-detected signals */}
                      <div className="mt-1.5 space-y-0.5">
                        {r.autoScoreState === 'loading' && (
                          <span className="text-[9px] text-slate-600 animate-pulse">Analysing…</span>
                        )}
                        {r.empCount != null && (
                          <div className="text-[9px] bg-slate-800 text-slate-400 rounded px-1 py-0.5">
                            👥 {r.empCount} emp
                          </div>
                        )}
                        {r.hiringSignal !== 'none' && (
                          <div className="text-[9px] bg-emerald-900/50 text-emerald-400 rounded px-1 py-0.5 leading-tight">
                            {r.hiringSignal === 'design_engineer' ? '🔧 Hiring Design Eng' :
                             r.hiringSignal === 'mechanical_engineer' ? '⚙ Hiring Mech Eng' :
                             r.hiringSignal === 'new_product_post' ? '🚀 New Product' : '🏭 Eng Team'}
                          </div>
                        )}
                        {r.growthSignal !== 'none' && (
                          <div className="text-[9px] bg-blue-900/50 text-blue-400 rounded px-1 py-0.5 leading-tight">
                            {r.growthSignal === 'new_factory' ? '🏗 New Factory' :
                             r.growthSignal === 'new_product' ? '🚀 New Product' :
                             r.growthSignal === 'contract_win' ? '📋 Contract Win' : '📈 Expanding'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <div className="font-medium text-slate-100 text-sm leading-snug">{r.company_name}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        #{r.company_number} · est. {r.date_of_creation?.slice(0, 4) ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
                      <div>{r.registered_office_address.locality ?? '—'}</div>
                      <div className="text-[10px] text-slate-600">{r.registered_office_address.postal_code ?? ''}</div>
                    </td>
                    <td className="px-3 py-3 max-w-[160px]">
                      {r.sic_codes.map(code => (
                        <div key={code} className="text-[10px] text-slate-500 leading-snug">
                          {code} · {getSicDescription(code)}
                        </div>
                      ))}
                    </td>
                    {/* Email / Website */}
                    <td className="px-3 py-3 max-w-[180px]">
                      {r.autoScoreState === 'loading' && (
                        <span className="text-[10px] text-slate-600 animate-pulse">Searching…</span>
                      )}
                      {r.autoScoreState === 'idle' && (
                        <button
                          onClick={() => autoScore(r.company_number, r.company_name)}
                          className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition-colors">
                          Find email
                        </button>
                      )}
                      {r.autoScoreState === 'done' && (
                        <div className="space-y-1">
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noreferrer"
                              className="text-[10px] text-blue-400 hover:text-blue-300 block truncate max-w-[160px]">
                              🌐 {r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                          )}
                          {r.emails.length > 0 ? (
                            r.emails.map(email => (
                              <a key={email} href={`mailto:${email}`}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 block">
                                ✉ {email}
                              </a>
                            ))
                          ) : (
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-600">No email found</span>
                              <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent('Engineering Manager ' + r.company_name)}`}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                                <LiIcon /> Find on LinkedIn
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      {r.officersState === 'loading' && (
                        <span className="text-[10px] text-slate-600 animate-pulse">Finding directors…</span>
                      )}
                      {r.officersState === 'done' && (!r.officers || r.officers.length === 0) && (
                        <span className="text-[10px] text-slate-600">No active officers found</span>
                      )}
                      {r.officersState === 'done' && r.officers && r.officers.slice(0, 3).map((o, i) => (
                        <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-slate-800' : ''}>
                          <div className="text-xs text-slate-200 font-medium leading-tight">{o.name}</div>
                          <div className="text-[10px] text-slate-500 capitalize mb-1">
                            {o.officer_role.replace(/-/g, ' ')}
                          </div>
                          <a href={liPersonUrl(o.name, r.company_name)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                            <LiIcon /> Search director
                          </a>
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap space-y-2">
                      <a href={`https://find-and-update.company-information.service.gov.uk/company/${r.company_number}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
                        ⊡ Companies House
                      </a>
                      <a href={liCompanyUrl(r.company_name)} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                        <LiIcon /> Company LinkedIn
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      {/* Engagement — only manual signal */}
                      <div className="mb-2">
                        <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">LinkedIn</div>
                        <select
                          value={r.engagement}
                          onChange={e => updateEngagement(r.company_number, e.target.value as LinkedInEngagement)}
                          className="w-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="none">No Response</option>
                          <option value="accepted">Accepted Connection (+10)</option>
                          <option value="replied">Replied to Message (+10)</option>
                          <option value="meeting">Meeting Booked (+10)</option>
                        </select>
                      </div>
                      <CHPushButton result={r} engScore={r._score} engGrade={r._grade} onDone={handlePushDone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <div className="text-4xl mb-3">⊡</div>
          <p className="text-slate-400 font-medium">Search Companies House for UK engineering manufacturers</p>
          <p className="text-slate-600 text-sm mt-1">Active companies only · auto-fetches directors · LinkedIn search links generated</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function ProspectFinderPage() {
  const [activeTab, setActiveTab] = useState<'v1' | 'v2' | 'ch'>('v1');
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
        <button
          onClick={() => setActiveTab('ch')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'ch' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⊡ CH Engineering <span className="text-[10px] ml-1 opacity-60">Companies House</span>
        </button>
      </div>

      {activeTab === 'v2' && <V2ScorerTab />}
      {activeTab === 'ch' && <CHEngineeringTab />}

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
