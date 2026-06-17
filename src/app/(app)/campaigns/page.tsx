'use client';

import { useMemo, useState } from 'react';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

type CampaignRow = {
  id: number;
  campaign_name: string;
  target_industry: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  focus_service: string | null;
  services: string[];
  status: CampaignStatus;
  created_at: string;
};

const SERVICE_OPTIONS = [
  { key: 'crm', label: 'CRM' },
  { key: 'saas', label: 'SaaS' },
  { key: 'web_development', label: 'Web Development' },
  { key: 'ai_automation', label: 'AI Automation' },
  { key: 'iot', label: 'IoT' },
  { key: 'engineering', label: 'Engineering' },
] as const;

const CRM_DAILY_ACTIVITIES = [
  '5 LinkedIn connections per day',
  '2 follow-up messages',
  '1 Upwork proposal per day',
  '15 min CRM improvement',
  'Respond to LinkedIn/Upwork messages',
];

const CRM_WEEKLY_ACTIVITIES = [
  'Publish 1 LinkedIn post',
  'Publish 1 YouTube video',
  'Apply to 5 Upwork projects',
  '1 CRM demo or feedback session',
  'Review product roadmap',
  'Publish 1 blog article',
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function CampaignsPage() {
  const defaultStart = todayIsoDate();
  const [campaignName, setCampaignName] = useState('CRM Campaign - 90 Days');
  const [targetIndustry, setTargetIndustry] = useState('UK Manufacturing');
  const [status, setStatus] = useState<CampaignStatus>('active');
  const [startDate, setStartDate] = useState(defaultStart);
  const [durationDays, setDurationDays] = useState(90);
  const [focusService, setFocusService] = useState('crm');
  const [services, setServices] = useState<string[]>(['crm']);
  const [objective, setObjective] = useState(
    'Build predictable CRM-focused pipeline over 90 days with outbound + LinkedIn follow-ups.'
  );

  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);
  const [playbookMessage, setPlaybookMessage] = useState('');

  const endDate = useMemo(() => addDaysIso(startDate, durationDays), [startDate, durationDays]);

  async function loadCampaigns() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = (await res.json()) as CampaignRow[];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  function toggleService(serviceKey: string) {
    setServices((prev) => {
      if (prev.includes(serviceKey)) {
        const next = prev.filter((item) => item !== serviceKey);
        return next.length === 0 ? ['crm'] : next;
      }
      return [...prev, serviceKey];
    });
  }

  async function createCampaign() {
    setCreating(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        campaign_name: campaignName.trim(),
        target_industry: targetIndustry.trim() || null,
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        focus_service: focusService,
        services,
        objective: objective.trim() || null,
        status,
      };

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Campaign creation failed');
      }

      const created = (await res.json()) as CampaignRow;
      setCampaigns((prev) => [created, ...prev]);
      setMessage('Campaign created successfully. CRM 90-day campaign is now active.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Campaign creation failed');
    } finally {
      setCreating(false);
    }
  }

  async function createWeeklyPlaybookTasks() {
    setCreatingPlaybook(true);
    setError('');
    setPlaybookMessage('');
    try {
      const res = await fetch('/api/campaigns/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Failed to create playbook tasks');
      }
      const data = (await res.json()) as { created: number; startDate: string; endDate: string };
      setPlaybookMessage(
        `Created ${data.created} tasks for ${data.startDate} to ${data.endDate}. Check the Tasks page.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create playbook tasks');
    } finally {
      setCreatingPlaybook(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-100">Campaign Planner</h1>
        <p className="text-sm text-slate-400">
          Create focused campaigns by service line. Your CRM 90-day campaign is pre-filled below.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Campaign Name</label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Target Industry</label>
              <input
                value={targetIndustry}
                onChange={(e) => setTargetIndustry(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Duration (Days)</label>
              <input
                type="number"
                min={7}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value) || 90)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">End Date (Calculated)</label>
              <input
                value={endDate}
                readOnly
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Primary Focus</label>
              <select
                value={focusService}
                onChange={(e) => {
                  const selected = e.target.value;
                  setFocusService(selected);
                  if (!services.includes(selected)) setServices((prev) => [...prev, selected]);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {SERVICE_OPTIONS.map((service) => (
                  <option key={service.key} value={service.key}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Service Lines</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((service) => {
                const active = services.includes(service.key);
                return (
                  <button
                    key={service.key}
                    type="button"
                    onClick={() => toggleService(service.key)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      active
                        ? 'bg-blue-600/25 border-blue-400 text-blue-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {service.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Objective</label>
            <textarea
              rows={4}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={createCampaign}
              disabled={creating || !campaignName.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Start Campaign'}
            </button>
            <button
              onClick={() => {
                setCampaignName('CRM Campaign - 90 Days');
                setTargetIndustry('UK Manufacturing');
                setStatus('active');
                setStartDate(todayIsoDate());
                setDurationDays(90);
                setFocusService('crm');
                setServices(['crm']);
                setObjective('Build predictable CRM-focused pipeline over 90 days with outbound + LinkedIn follow-ups.');
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm rounded-lg transition-colors"
            >
              Reset to CRM 90-Day Preset
            </button>
          </div>

          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>

        <aside className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Campaign Snapshot</h2>
          <div className="text-sm text-slate-400 space-y-1">
            <p>Focus: <span className="text-slate-200 uppercase">{focusService.replace('_', ' ')}</span></p>
            <p>Duration: <span className="text-slate-200">{durationDays} days</span></p>
            <p>Window: <span className="text-slate-200">{startDate} to {endDate}</span></p>
            <p>Services selected: <span className="text-slate-200">{services.length}</span></p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 leading-relaxed">
            Recommended for your current goal: run one focused CRM campaign for 90 days, measure acceptance/reply/meetings weekly, and only then scale to SaaS or Web Development.
          </div>
          <button
            onClick={loadCampaigns}
            className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : 'Load Existing Campaigns'}
          </button>
        </aside>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-200">CRM Campaign Activity Playbook</h2>
            <p className="text-xs text-slate-400">Based on your FW24 plan for daily and weekly execution.</p>
          </div>
          <button
            onClick={createWeeklyPlaybookTasks}
            disabled={creatingPlaybook}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creatingPlaybook ? 'Creating tasks...' : 'Create This Week Tasks'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Daily Activities</h3>
            <ul className="text-sm text-slate-300 space-y-1.5">
              {CRM_DAILY_ACTIVITIES.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Weekly Activities</h3>
            <ul className="text-sm text-slate-300 space-y-1.5">
              {CRM_WEEKLY_ACTIVITIES.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {playbookMessage && <p className="text-sm text-emerald-400">{playbookMessage}</p>}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Existing Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No campaigns loaded yet. Click "Load Existing Campaigns" to fetch them.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Focus</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Services</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-slate-800/60 text-slate-300">
                    <td className="py-2 pr-4">{campaign.campaign_name}</td>
                    <td className="py-2 pr-4 uppercase">{(campaign.focus_service ?? 'n/a').replace('_', ' ')}</td>
                    <td className="py-2 pr-4">{campaign.duration_days ?? 'n/a'} days</td>
                    <td className="py-2 pr-4 capitalize">{campaign.status}</td>
                    <td className="py-2 pr-4">{campaign.services?.join(', ') || 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
