'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Lead, LeadStage } from '@/lib/types';
import { PIPELINE_STAGES } from '@/lib/types';

const STAGE_COLORS: Record<string, string> = {
  lead:'border-slate-600', contacted:'border-blue-600',
  meeting_scheduled:'border-violet-600', requirements:'border-amber-600',
  proposal_sent:'border-orange-600', negotiation:'border-rose-600',
  won:'border-emerald-600', lost:'border-red-600',
};

const SCORE_COLOR = (s: number) => s >= 70 ? 'text-red-400' : s >= 50 ? 'text-amber-400' : 'text-slate-500';

function LeadCard({ lead, isDragging = false, onMarkContacted }: { lead: Lead; isDragging?: boolean; onMarkContacted: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isSortableDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing ${isDragging ? 'ring-1 ring-blue-500 shadow-lg shadow-blue-500/10' : ''}`}>
      <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()}
        className="block text-sm font-medium text-slate-100 hover:text-blue-400 mb-1 truncate" title={lead.company_name}>
        {lead.company_name}
      </Link>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 truncate">{lead.location || '—'}</span>
        <span className={`text-xs font-bold ${SCORE_COLOR(lead.lead_score)}`}>{lead.lead_score}</span>
      </div>
      {lead.source && <div className="text-xs text-slate-600 mt-0.5 capitalize">{lead.source.replace('_',' ')}</div>}
      <div className="mt-2 flex items-center justify-between">
        {lead.contacted_at ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-400">✉ Contacted</span>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onMarkContacted(lead.id); }}
            onPointerDown={e => e.stopPropagation()}
            className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-emerald-800 text-slate-400 hover:text-emerald-300 transition-colors">
            ✓ Mark Contacted
          </button>
        )}
      </div>
    </div>
  );
}

function Column({ stage, leads, onMarkContacted }: { stage: { key: string; label: string }; leads: Lead[]; onMarkContacted: (id: number) => void }) {
  return (
    <div className={`flex flex-col w-52 flex-shrink-0 bg-slate-900 border-t-2 ${STAGE_COLORS[stage.key]} rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-300">{stage.label}</span>
        <span className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{leads.length}</span>
      </div>
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[4rem]">
          {leads.map(l => <LeadCard key={l.id} lead={l} onMarkContacted={onMarkContacted} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [createdBy, setCreatedBy] = useState('');
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (createdBy) p.set('assigned_to', createdBy);
    const res = await fetch(`/api/leads?${p}`);
    if (res.ok) setLeads(await res.json());
  }, [createdBy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : []));
  }, []);

  const byStage = (key: string) => leads.filter(l => l.stage === key);
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as number); }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const overStage = String(over.id) as LeadStage;
    const draggedLead = leads.find(l => l.id === active.id);

    if (!draggedLead || draggedLead.stage === overStage) return;

    setLeads(prev =>
      prev.map(l => (l.id === active.id ? { ...l, stage: overStage } : l))
    );

    await fetch(`/api/leads/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: overStage }),
    });
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;

    const overId = over.id as number;
    const overLead = leads.find(l => l.id === overId);
    if (!overLead) return;

    const activeId = active.id as number;
    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead || activeLead.stage === overLead.stage) return;

    setLeads(prev => prev.map(l => l.id === activeId ? { ...l, stage: overLead.stage } : l));
  }

  async function markContacted(id: number) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted_at: new Date().toISOString() } : l));
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacted_at: new Date().toISOString() }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Pipeline</h1>
          <p className="text-sm text-slate-500">{leads.length} leads · drag to change stage</p>
        </div>
        {users.length > 0 && (
          <select
            value={createdBy}
            onChange={e => setCreatedBy(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">All users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
          <div className="flex gap-3" style={{ minWidth: `${PIPELINE_STAGES.length * 220}px` }}>
            {PIPELINE_STAGES.map(s => <Column key={s.key} stage={s} leads={byStage(s.key)} onMarkContacted={markContacted} />)}
          </div>
          <DragOverlay>
            {activeLead ? (
              <div className="bg-slate-800 border border-blue-500 rounded-lg p-3 shadow-lg w-52">
                <div className="text-sm font-medium text-slate-100 truncate">{activeLead.company_name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{activeLead.location || '—'}</span>
                  <span className={`text-xs font-bold ${SCORE_COLOR(activeLead.lead_score)}`}>{activeLead.lead_score}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
