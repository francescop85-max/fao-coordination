'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from './store';
import { Meeting, MeetingType } from './types';
import { format, parseISO, isAfter, isBefore, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarDays, AlertCircle, Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';

const TYPE_BG: Record<string, string> = {
  'Kick-off Meeting': 'bg-green-100 text-green-800',
  'Close-out Meeting': 'bg-purple-100 text-purple-800',
  'Regular Coordination Meeting': 'bg-blue-100 text-blue-800',
  'Donor Review Meeting': 'bg-orange-100 text-orange-800',
  'Ad-hoc Meeting': 'bg-slate-100 text-slate-700',
};

const TYPE_DOT: Record<string, string> = {
  'Kick-off Meeting': '#2e7d32',
  'Close-out Meeting': '#7b1fa2',
  'Regular Coordination Meeting': '#007bc0',
  'Donor Review Meeting': '#e65100',
  'Ad-hoc Meeting': '#546e7a',
};

const STATUS_BG: Record<string, string> = {
  'Scheduled': 'bg-sky-100 text-sky-700',
  'Completed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-600',
};

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<{ id: string; symbol: string; status?: string }[]>([]);
  const [filterPM, setFilterPM] = useState('');

  useEffect(() => {
    const load = async () => {
      setMeetings(await store.getMeetings());
      setProjects(await store.getProjects());
    };
    load();
  }, []);

  const pmOptions = Array.from(new Set(
    meetings.map(m => m.projectManager.split('(')[0].trim()).filter(Boolean)
  )).sort();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const in30 = addDays(today, 30);
  const in7 = addDays(today, 7);

  const allMeetings = filterPM ? meetings.filter(m => m.projectManager.includes(filterPM)) : meetings;
  const scheduled = allMeetings.filter(m => m.status === 'Scheduled');
  const completed = allMeetings.filter(m => m.status === 'Completed');
  const cancelled = allMeetings.filter(m => m.status === 'Cancelled');

  const thisWeek = scheduled.filter(m => {
    if (!m.date) return false;
    const d = parseISO(m.date);
    return d >= weekStart && d <= weekEnd;
  });

  const next30 = scheduled
    .filter(m => {
      if (!m.date) return false;
      const d = parseISO(m.date);
      return isAfter(d, today) && isBefore(d, in30);
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Count by type (scheduled only)
  const byType = Object.entries(
    scheduled.reduce<Record<string, number>>((acc, m) => {
      acc[m.meetingType] = (acc[m.meetingType] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  // Projects with no meetings
  const meetingProjectIds = new Set(meetings.map(m => m.projectId));
  const activeProjects = projects.filter(p =>
    p.status?.includes('Active') && !p.status?.includes('Pipeline')
  );
  const noMeetingProjects = activeProjects.filter(p => !meetingProjectIds.has(p.id));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meetings Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{format(today, 'EEEE, d MMMM yyyy')} · FAO Ukraine Country Office</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pmOptions.length > 0 && (
            <select
              value={filterPM}
              onChange={e => setFilterPM(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All project managers</option>
              {pmOptions.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          )}
          <Link
            href="/meetings"
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#006aa0] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={15} /> Schedule Meeting
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<CalendarDays size={18} className="text-blue-600" />}
          label="Scheduled"
          value={scheduled.length}
          sub="Total upcoming"
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Clock size={18} className="text-amber-600" />}
          label="This week"
          value={thisWeek.length}
          sub={`${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM')}`}
          bg="bg-amber-50"
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-green-600" />}
          label="Completed"
          value={completed.length}
          sub="All time"
          bg="bg-green-50"
        />
        <StatCard
          icon={<XCircle size={18} className="text-slate-400" />}
          label="Cancelled"
          value={cancelled.length}
          sub="All time"
          bg="bg-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming 30 days */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <CalendarDays size={15} /> Upcoming Meetings — next 30 days
            </h2>
            <Link href="/meetings" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto scrollbar-thin">
            {next30.length === 0 && (
              <p className="px-5 py-10 text-slate-400 text-sm text-center">No meetings scheduled in the next 30 days</p>
            )}
            {next30.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                {/* Date block */}
                <div className="shrink-0 text-center w-10">
                  <div className="text-xs text-slate-400 uppercase leading-tight">{format(parseISO(m.date), 'MMM')}</div>
                  <div className="text-xl font-bold text-slate-700 leading-tight">{format(parseISO(m.date), 'd')}</div>
                  <div className="text-xs text-slate-400 leading-tight">{format(parseISO(m.date), 'EEE')}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{m.projectSymbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BG[m.meetingType] ?? 'bg-slate-100 text-slate-700'}`}>
                      {m.meetingType}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{m.projectTitle}</div>
                  <div className="text-xs text-slate-400 mt-0.5">PM: {m.projectManager.split('(')[0].trim()}</div>
                </div>
                {isBefore(parseISO(m.date), in7) && isAfter(parseISO(m.date), today) && (
                  <span className="shrink-0 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Meetings by type */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm">Scheduled by Type</h2>
            </div>
            <div className="px-5 py-3 space-y-3">
              {byType.length === 0 && (
                <p className="text-slate-400 text-xs py-2 text-center">No meetings scheduled</p>
              )}
              {byType.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_DOT[type] ?? '#94a3b8' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-600 truncate">{type}</div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((count / (scheduled.length || 1)) * 100)}%`,
                          backgroundColor: TYPE_DOT[type] ?? '#94a3b8',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* No-meeting warning */}
          {noMeetingProjects.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    {noMeetingProjects.length} active project{noMeetingProjects.length > 1 ? 's' : ''} with no meetings
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {noMeetingProjects.map(p => (
                      <span key={p.id} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{p.symbol.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* This week detail */}
          {thisWeek.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <Clock size={14} /> This Week
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {thisWeek.map(m => (
                  <div key={m.id} className="px-4 py-2.5">
                    <div className="text-xs font-medium text-slate-700">{m.projectSymbol}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{format(parseISO(m.date), 'EEE d MMM')}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BG[m.status]}`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, bg }: {
  icon: React.ReactNode; label: string; value: number; sub: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-slate-200`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
