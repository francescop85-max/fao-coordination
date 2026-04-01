'use client';

import { useEffect, useState } from 'react';
import { store } from '../store';
import { Meeting, MeetingType, MeetingStatus, Project } from '../types';
import {
  Plus, LayoutList, BarChart2, X, ChevronLeft, ChevronRight,
  Pencil, Trash2, Check, Search, Paperclip, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import Attachments, { AttachmentBadge } from '../components/Attachments';

const MEETING_TYPES: MeetingType[] = [
  'Kick-off Meeting',
  'Close-out Meeting',
  'Regular Coordination Meeting',
  'Donor Review Meeting',
  'Ad-hoc Meeting',
];

const STATUS_OPTIONS: MeetingStatus[] = ['Scheduled', 'Completed', 'Cancelled'];

const TYPE_COLORS: Record<MeetingType, string> = {
  'Kick-off Meeting': '#2e7d32',
  'Close-out Meeting': '#7b1fa2',
  'Regular Coordination Meeting': '#007bc0',
  'Donor Review Meeting': '#e65100',
  'Ad-hoc Meeting': '#546e7a',
};

const TYPE_BG: Record<MeetingType, string> = {
  'Kick-off Meeting': 'bg-green-100 text-green-800',
  'Close-out Meeting': 'bg-purple-100 text-purple-800',
  'Regular Coordination Meeting': 'bg-blue-100 text-blue-800',
  'Donor Review Meeting': 'bg-orange-100 text-orange-800',
  'Ad-hoc Meeting': 'bg-slate-100 text-slate-700',
};

const STATUS_BG: Record<MeetingStatus, string> = {
  'Scheduled': 'bg-sky-100 text-sky-700',
  'Completed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-600',
};

const EMPTY_MEETING: Omit<Meeting, 'id'> = {
  projectId: '', projectSymbol: '', projectTitle: '', projectManager: '',
  date: '', meetingType: 'Regular Coordination Meeting', status: 'Scheduled',
  agenda: '', notes: '', attendees: '', attachments: [],
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'list' | 'gantt'>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Meeting, 'id'>>(EMPTY_MEETING);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPM, setFilterPM] = useState('');

  useEffect(() => {
    setMeetings(store.getMeetings());
    setProjects(store.getProjects());
  }, []);

  const save = (updated: Meeting[]) => {
    store.saveMeetings(updated);
    setMeetings(updated);
  };

  const handleProjectChange = (projectId: string) => {
    const p = projects.find(p => p.id === projectId);
    if (p) {
      setForm(prev => ({
        ...prev,
        projectId: p.id,
        projectSymbol: p.symbol.trim(),
        projectTitle: p.title,
        projectManager: p.projectManager || p.ltoOfficer,
      }));
    }
  };

  const commitForm = () => {
    if (!form.date || !form.projectId) return;
    if (editingId) {
      save(meetings.map(m => m.id === editingId ? { ...form, id: editingId } : m));
      setEditingId(null);
    } else {
      save([...meetings, { ...form, id: Date.now().toString() }]);
    }
    setShowForm(false);
    setForm(EMPTY_MEETING);
  };

  const startEdit = (m: Meeting) => {
    setEditingId(m.id);
    setForm({ ...m, attachments: m.attachments ?? [] });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMeeting = (id: string) => {
    save(meetings.filter(m => m.id !== id));
    setDeleteConfirm(null);
  };

  // Live-save attachment changes from the list view expand panel
  const updateAttachments = (meetingId: string, updatedAttachments: Meeting['attachments']) => {
    save(meetings.map(m => m.id === meetingId ? { ...m, attachments: updatedAttachments } : m));
  };

  const pmOptions = Array.from(new Set(
    meetings.map(m => m.projectManager.split('(')[0].trim()).filter(Boolean)
  )).sort();

  const filtered = meetings.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.projectSymbol.toLowerCase().includes(q) || m.projectTitle.toLowerCase().includes(q) || m.projectManager.toLowerCase().includes(q);
    const matchType = !filterType || m.meetingType === filterType;
    const matchStatus = !filterStatus || m.status === filterStatus;
    const matchPM = !filterPM || m.projectManager.includes(filterPM);
    return matchSearch && matchType && matchStatus && matchPM;
  }).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Coordination Meetings</h1>
          <p className="text-slate-500 text-sm">{meetings.length} meetings · {meetings.reduce((n, m) => n + (m.attachments?.length ?? 0), 0)} documents attached</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutList size={13} /> List
            </button>
            <button
              onClick={() => setView('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'gantt' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart2 size={13} /> Gantt
            </button>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_MEETING); }}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#006aa0] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={15} /> Add Meeting
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-blue-800">{editingId ? 'Edit Meeting' : 'New Meeting'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <MeetingForm
            form={form}
            projects={projects}
            meetingId={editingId ?? 'new'}
            onChange={(field, val) => setForm(prev => ({ ...prev, [field]: val }))}
            onAttachmentsChange={atts => setForm(prev => ({ ...prev, attachments: atts }))}
            onProjectChange={handleProjectChange}
            onSave={commitForm}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search project…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All types</option>
          {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All project managers</option>
          {pmOptions.map(pm => <option key={pm} value={pm}>{pm}</option>)}
        </select>
      </div>

      {view === 'list' ? (
        <ListView
          meetings={filtered}
          onEdit={startEdit}
          onDelete={id => setDeleteConfirm(id)}
          deleteConfirm={deleteConfirm}
          onDeleteConfirm={deleteMeeting}
          onDeleteCancel={() => setDeleteConfirm(null)}
          onAttachmentsChange={updateAttachments}
        />
      ) : (
        <GanttView meetings={filtered} projects={projects} />
      )}
    </div>
  );
}

/* ── List View ─────────────────────────────────────────────────────────── */

function ListView({ meetings, onEdit, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel, onAttachmentsChange }: {
  meetings: Meeting[];
  onEdit: (m: Meeting) => void;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  onAttachmentsChange: (meetingId: string, atts: Meeting['attachments']) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Symbol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Project Manager</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Meeting Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Files</th>
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No meetings found. Click "Add Meeting" to get started.</td></tr>
            )}
            {meetings.map(m => {
              const isExpanded = expandedId === m.id;
              const attachments = m.attachments ?? [];
              return (
                <>
                  <tr key={m.id} className={`border-b border-slate-100 transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {m.date ? format(parseISO(m.date), 'd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{m.projectSymbol}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                      <div className="line-clamp-2">{m.projectTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.projectManager.split('(')[0].trim()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BG[m.meetingType] ?? 'bg-slate-100 text-slate-700'}`}>
                        {m.meetingType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BG[m.status]}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
                        title="Manage attachments"
                      >
                        <AttachmentBadge count={attachments.length} />
                        {attachments.length === 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500">
                            <Paperclip size={12} /> Upload
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(m)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {deleteConfirm === m.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => onDeleteConfirm(m.id)} className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"><Check size={13} /></button>
                            <button onClick={onDeleteCancel} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><X size={13} /></button>
                          </span>
                        ) : (
                          <button onClick={() => onDelete(m.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${m.id}-files`} className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="max-w-xl">
                          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <Paperclip size={12} /> Meeting Documents — {m.projectSymbol} · {m.date ? format(parseISO(m.date), 'd MMM yyyy') : ''}
                          </p>
                          <Attachments
                            meetingId={m.id}
                            attachments={attachments}
                            onChange={updated => onAttachmentsChange(m.id, updated)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Gantt View ─────────────────────────────────────────────────────────── */

function GanttView({ meetings, projects }: { meetings: Meeting[]; projects: Project[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ meeting: Meeting; x: number; y: number } | null>(null);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  const projectSymbols = Array.from(new Set(
    meetings
      .filter(m => {
        if (!m.date) return false;
        const d = parseISO(m.date);
        return d >= start && d <= end;
      })
      .map(m => m.projectSymbol)
  ));

  const allActiveSymbols = Array.from(new Set([
    ...projectSymbols,
    ...projects
      .filter(p => p.status.includes('Active') && !p.status.includes('Pipeline'))
      .map(p => p.symbol.trim())
  ]));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <h2 className="font-semibold text-slate-700">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="px-5 py-2 flex flex-wrap gap-3 border-b border-slate-100">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {type}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <div style={{ minWidth: Math.max(800, days.length * 28 + 200) }}>
          <div className="flex border-b border-slate-100 bg-slate-50">
            <div className="w-48 shrink-0 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-slate-100">Project</div>
            {days.map(day => (
              <div
                key={day.toISOString()}
                className={`flex-1 text-center py-2 text-xs border-r border-slate-100 ${isToday(day) ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-400'} ${getDay(day) === 0 || getDay(day) === 6 ? 'bg-slate-50' : ''}`}
                style={{ minWidth: 28 }}
              >
                <div className="font-medium">{format(day, 'd')}</div>
                <div className="text-slate-300">{format(day, 'EEEEE')}</div>
              </div>
            ))}
          </div>

          {allActiveSymbols.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">No projects or meetings to display</div>
          )}
          {allActiveSymbols.map(symbol => {
            const projectMeetings = meetings.filter(m => m.projectSymbol === symbol);
            return (
              <div key={symbol} className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors" style={{ minHeight: 40 }}>
                <div className="w-48 shrink-0 px-3 py-2 border-r border-slate-100 flex items-center">
                  <span className="text-xs font-mono text-slate-700 truncate" title={symbol}>{symbol}</span>
                </div>
                {days.map(day => {
                  const dayMeetings = projectMeetings.filter(m => m.date && isSameDay(parseISO(m.date), day));
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 border-r border-slate-100 flex items-center justify-center gap-0.5 py-1 ${getDay(day) === 0 || getDay(day) === 6 ? 'bg-slate-50' : ''} ${isToday(day) ? 'bg-blue-50' : ''}`}
                      style={{ minWidth: 28 }}
                    >
                      {dayMeetings.map(m => (
                        <button
                          key={m.id}
                          className="w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform border-2 border-white shadow-sm"
                          style={{ backgroundColor: TYPE_COLORS[m.meetingType] }}
                          onMouseEnter={e => {
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setTooltip({ meeting: m, x: rect.left, y: rect.top });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs pointer-events-none max-w-64"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}
        >
          <div className="font-semibold text-slate-800 mb-1">{tooltip.meeting.projectSymbol}</div>
          <div className="text-slate-600 mb-1">{tooltip.meeting.projectTitle}</div>
          <div className="flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLORS[tooltip.meeting.meetingType] }} />
            <span>{tooltip.meeting.meetingType}</span>
          </div>
          <div className="text-slate-500">{format(parseISO(tooltip.meeting.date), 'd MMMM yyyy')}</div>
          <div className="text-slate-500">PM: {tooltip.meeting.projectManager.split('(')[0].trim()}</div>
          {(tooltip.meeting.attachments?.length ?? 0) > 0 && (
            <div className="mt-1 flex items-center gap-1 text-slate-500">
              <Paperclip size={10} /> {tooltip.meeting.attachments!.length} document{tooltip.meeting.attachments!.length > 1 ? 's' : ''}
            </div>
          )}
          {tooltip.meeting.status !== 'Scheduled' && (
            <div className={`mt-1 font-medium ${tooltip.meeting.status === 'Completed' ? 'text-green-600' : 'text-red-500'}`}>{tooltip.meeting.status}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Meeting Form ─────────────────────────────────────────────────────── */

function MeetingForm({
  form, projects, meetingId, onChange, onAttachmentsChange, onProjectChange, onSave, onCancel,
}: {
  form: Omit<Meeting, 'id'>;
  projects: Project[];
  meetingId: string;
  onChange: (field: keyof Omit<Meeting, 'id'>, val: string) => void;
  onAttachmentsChange: (atts: Meeting['attachments']) => void;
  onProjectChange: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
          <select className="input-sm w-full" value={form.projectId} onChange={e => onProjectChange(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.symbol.trim()} – {p.title.slice(0, 50)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
          <input type="date" className="input-sm w-full" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Type</label>
          <select className="input-sm w-full" value={form.meetingType} onChange={e => onChange('meetingType', e.target.value)}>
            {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select className="input-sm w-full" value={form.status} onChange={e => onChange('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Attendees</label>
          <input className="input-sm w-full" value={form.attendees} onChange={e => onChange('attendees', e.target.value)} placeholder="Names or roles" />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Agenda</label>
          <textarea className="input-sm w-full" rows={2} value={form.agenda} onChange={e => onChange('agenda', e.target.value)} placeholder="Meeting agenda…" />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes / Minutes</label>
          <textarea className="input-sm w-full" rows={2} value={form.notes} onChange={e => onChange('notes', e.target.value)} placeholder="Meeting notes or minutes…" />
        </div>
      </div>

      {/* Attachments section */}
      <div className="border-t border-blue-100 pt-3">
        <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
          <Paperclip size={12} /> Documents / Minutes
        </label>
        <Attachments
          meetingId={meetingId}
          attachments={form.attachments ?? []}
          onChange={onAttachmentsChange}
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!form.date || !form.projectId} className="px-3 py-1.5 text-sm bg-[#007bc0] text-white rounded-lg hover:bg-[#006aa0] transition-colors font-medium disabled:opacity-50">Save Meeting</button>
      </div>
    </div>
  );
}
