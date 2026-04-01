'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { store } from '../store';
import { Project } from '../types';
import { differenceInDays, parse, isValid } from 'date-fns';
import {
  AlertTriangle, TrendingUp, DollarSign, Clock,
  Printer, Filter, ChevronDown, Table2, BarChart3,
} from 'lucide-react';

// ── Risk logic ───────────────────────────────────────────────────────────────

type RiskLevel = 'Critical' | 'High Risk' | 'Monitor' | 'On Track' | 'N/A';

const RISK_STYLE: Record<RiskLevel, { badge: string; bar: string; dot: string; row: string }> = {
  'Critical':  { badge: 'bg-red-100 text-red-700 font-semibold',      bar: '#ef4444', dot: '#ef4444', row: 'bg-red-50' },
  'High Risk': { badge: 'bg-orange-100 text-orange-700 font-semibold', bar: '#f97316', dot: '#f97316', row: 'bg-orange-50' },
  'Monitor':   { badge: 'bg-amber-100 text-amber-700',                 bar: '#f59e0b', dot: '#f59e0b', row: '' },
  'On Track':  { badge: 'bg-green-100 text-green-700',                 bar: '#2e7d32', dot: '#2e7d32', row: '' },
  'N/A':       { badge: 'bg-slate-100 text-slate-500',                 bar: '#94a3b8', dot: '#94a3b8', row: '' },
};

const RISK_ORDER: RiskLevel[] = ['Critical', 'High Risk', 'Monitor', 'On Track', 'N/A'];

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const d1 = parse(s, 'dd/MM/yyyy', new Date());
  if (isValid(d1)) return d1;
  const d2 = new Date(s);
  return isValid(d2) ? d2 : null;
}

function getRisk(p: Project, today: Date): { level: RiskLevel; daysLeft: number | null } {
  if (!p.status.includes('Active') || p.status.includes('Pipeline')) {
    return { level: 'N/A', daysLeft: null };
  }
  const nte = parseDateStr(p.nte);
  const daysLeft = nte ? differenceInDays(nte, today) : null;
  const del = p.deliveryProgress ?? 0;

  let level: RiskLevel = 'On Track';
  if (daysLeft !== null && daysLeft < 0) {
    level = del < 90 ? 'Critical' : 'N/A';
  } else if (daysLeft !== null && daysLeft <= 60 && del < 20) {
    level = 'Critical';
  } else if (daysLeft !== null && daysLeft <= 90 && del < 30) {
    level = 'High Risk';
  } else if (daysLeft !== null && daysLeft <= 180 && del < 50) {
    level = 'Monitor';
  } else if (del < 30 && daysLeft !== null && daysLeft <= 365) {
    level = 'Monitor';
  }

  return { level, daysLeft };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'charts';

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterSymbols, setFilterSymbols] = useState<string[]>([]);
  const [filterLTO, setFilterLTO] = useState('');
  const [filterPM, setFilterPM] = useState('');
  const [filterDonor, setFilterDonor] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterStatus, setFilterStatus] = useState('Operationally Active');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const today = useMemo(() => new Date(), []);

  useEffect(() => { setProjects(store.getProjects()); }, []);

  const enriched = useMemo(() =>
    projects.map(p => ({ ...p, ...getRisk(p, today) })),
    [projects, today]
  );

  const ltoOptions = useMemo(() =>
    Array.from(new Set(projects.map(p => p.ltoOfficer.split('(')[0].trim()).filter(Boolean))).sort(),
    [projects]
  );

  const pmOptions = useMemo(() =>
    Array.from(new Set(projects.map(p => (p.projectManager ?? '').split('(')[0].trim()).filter(Boolean))).sort(),
    [projects]
  );

  const donorOptions = useMemo(() =>
    Array.from(new Set(projects.map(p => p.donors).filter(Boolean))).sort(),
    [projects]
  );

  const symbolOptions = useMemo(() =>
    projects.map(p => p.symbol.trim()).sort(),
    [projects]
  );

  const filtered = useMemo(() => enriched.filter(p => {
    if (filterSymbols.length > 0 && !filterSymbols.includes(p.symbol.trim())) return false;
    if (filterLTO && !p.ltoOfficer.includes(filterLTO)) return false;
    if (filterPM && !(p.projectManager ?? '').includes(filterPM)) return false;
    if (filterDonor && p.donors !== filterDonor) return false;
    if (filterRisk && p.level !== filterRisk) return false;
    if (filterStatus && p.status.trim() !== filterStatus) return false;
    return true;
  }), [enriched, filterSymbols, filterLTO, filterPM, filterDonor, filterRisk, filterStatus]);

  const activeFiltered = filtered.filter(p => p.status.includes('Active') && !p.status.includes('Pipeline'));
  const totalBudget    = activeFiltered.reduce((s, p) => s + (p.dwhBudget ?? 0), 0);
  const totalAvailable = activeFiltered.reduce((s, p) => s + (p.availableBudget ?? 0), 0);
  const avgDelivery    = activeFiltered.length
    ? Math.round(activeFiltered.reduce((s, p) => s + (p.deliveryProgress ?? 0), 0) / activeFiltered.length) : 0;
  const atRisk      = activeFiltered.filter(p => ['Critical','High Risk','Monitor'].includes(p.level)).length;
  const closingSoon = activeFiltered.filter(p => p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= 90).length;

  const activeFilters = [filterStatus, filterLTO, filterPM, filterDonor, filterRisk, ...filterSymbols].filter(Boolean).length;

  const resetFilters = () => {
    setFilterSymbols([]); setFilterLTO(''); setFilterPM(''); setFilterDonor('');
    setFilterRisk(''); setFilterStatus('Operationally Active');
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #portfolio-print, #portfolio-print * { visibility: visible; }
          #portfolio-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          @page { margin: 1.5cm; size: A4 landscape; }
        }
      `}</style>

      <div className="p-6 max-w-screen-xl mx-auto" id="portfolio-print">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 no-print">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Portfolio Analysis</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''}
              {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters !== 1 ? 's' : ''} active`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Table2 size={13} /> Table
              </button>
              <button
                onClick={() => setViewMode('charts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'charts' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BarChart3 size={13} /> Charts
              </button>
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              <Filter size={14} /> Filters
              {activeFilters > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{activeFilters}</span>
              )}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-[#003f7d] hover:bg-[#002d5a] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Printer size={14} /> Export PDF
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#003f7d] rounded flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">FAO</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">FAO Ukraine – Portfolio Analysis</h1>
              <p className="text-slate-500 text-xs">Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-5 bg-white border border-slate-200 rounded-xl p-4 no-print">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">Filters</span>
              <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Reset all</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select className="input-sm w-full" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {['Operationally Active','Activities Completed','Operationally Closed','Active Pipeline'].map(s =>
                    <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">LTO Officer</label>
                <select className="input-sm w-full" value={filterLTO} onChange={e => setFilterLTO(e.target.value)}>
                  <option value="">All LTO officers</option>
                  {ltoOptions.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project Manager</label>
                <select className="input-sm w-full" value={filterPM} onChange={e => setFilterPM(e.target.value)}>
                  <option value="">All PMs</option>
                  {pmOptions.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Donor</label>
                <select className="input-sm w-full" value={filterDonor} onChange={e => setFilterDonor(e.target.value)}>
                  <option value="">All donors</option>
                  {donorOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status flag</label>
                <select className="input-sm w-full" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                  <option value="">All</option>
                  {RISK_ORDER.filter(r => r !== 'N/A').map(r =>
                    <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
                <ProjectMultiSelect options={symbolOptions} selected={filterSymbols} onChange={setFilterSymbols} />
              </div>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <KpiCard icon={<TrendingUp size={16} className="text-blue-600" />}     label="Active Projects"  value={activeFiltered.length.toString()} bg="bg-blue-50" />
          <KpiCard icon={<DollarSign size={16} className="text-emerald-600" />}  label="Total Budget"     value={fmt(totalBudget)} sub={`${fmt(totalAvailable)} available`} bg="bg-emerald-50" />
          <KpiCard icon={<TrendingUp size={16} className="text-indigo-600" />}   label="Avg. Delivery"    value={`${avgDelivery}%`} sub="Active projects" bg="bg-indigo-50" />
          <KpiCard icon={<AlertTriangle size={16} className="text-amber-600" />} label="Needs attention"  value={atRisk.toString()} sub="Monitor or above" bg="bg-amber-50" />
          <KpiCard icon={<Clock size={16} className="text-red-500" />}           label="Closing soon"     value={closingSoon.toString()} sub="NTE within 90 days" bg="bg-red-50" />
        </div>

        {/* Risk distribution bar */}
        {activeFiltered.length > 0 && (
          <div className="mb-5 bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status distribution – active projects</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {RISK_ORDER.filter(r => r !== 'N/A').map(level => {
                const count = activeFiltered.filter(p => p.level === level).length;
                if (!count) return null;
                return (
                  <span key={level} className={`text-xs px-3 py-1 rounded-full ${RISK_STYLE[level].badge}`}>
                    {level}: {count}
                  </span>
                );
              })}
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              {RISK_ORDER.filter(r => r !== 'N/A').map(level => {
                const count = activeFiltered.filter(p => p.level === level).length;
                const pct = (count / activeFiltered.length) * 100;
                if (!pct) return null;
                return <div key={level} style={{ width: `${pct}%`, backgroundColor: RISK_STYLE[level].bar }} title={`${level}: ${count}`} />;
              })}
            </div>
          </div>
        )}

        {/* Main content: table or charts */}
        {viewMode === 'table' ? (
          <TableView projects={filtered} />
        ) : (
          <ChartsView projects={activeFiltered} />
        )}

        {/* Print footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400 text-center">
          FAO Ukraine Country Office · Confidential · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

      </div>
    </>
  );
}

// ── Table View ────────────────────────────────────────────────────────────────

type EnrichedProject = Project & { level: RiskLevel; daysLeft: number | null };

function TableView({ projects }: { projects: EnrichedProject[] }) {
  const sorted = [...projects].sort((a, b) => {
    // Primary: budget descending
    const budgetDiff = (b.dwhBudget ?? 0) - (a.dwhBudget ?? 0);
    if (budgetDiff !== 0) return budgetDiff;
    // Secondary: days remaining ascending (nulls last)
    if (a.daysLeft === null && b.daysLeft === null) return 0;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Symbol</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Project Manager</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Donor</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">NTE</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Days left</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Budget</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Available</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Delivery</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Flag</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">No projects match the current filters.</td></tr>
            )}
            {sorted.map(p => {
              const style = RISK_STYLE[p.level];
              return (
                <tr key={p.id} className={`border-b border-slate-100 ${style.row}`}>
                  <td className="px-3 py-3 font-mono text-xs font-medium text-slate-700">{p.symbol.trim()}</td>
                  <td className="px-3 py-3 text-slate-700"><div className="line-clamp-2 text-xs">{p.title}</div></td>
                  <td className="px-3 py-3 text-xs text-slate-600">{(p.projectManager ?? '').split('(')[0].trim() || '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 truncate">{p.donors}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{p.nte}</td>
                  <td className="px-3 py-3 text-xs font-medium whitespace-nowrap">
                    {p.daysLeft === null ? '—'
                      : p.daysLeft < 0 ? <span className="text-red-600">Overdue</span>
                      : <span className={p.daysLeft <= 90 ? 'text-red-600' : p.daysLeft <= 180 ? 'text-amber-600' : 'text-slate-600'}>{p.daysLeft}d</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-right text-slate-700 font-medium">{fmt(p.dwhBudget ?? 0)}</td>
                  <td className="px-3 py-3 text-xs text-right text-slate-700">{fmt(p.availableBudget ?? 0)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.deliveryProgress ?? 0}%`, backgroundColor: style.bar }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-8">{p.deliveryProgress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}>{p.level}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Charts View ───────────────────────────────────────────────────────────────

function ChartsView({ projects }: { projects: EnrichedProject[] }) {
  if (projects.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No active projects to display.</div>;
  }

  const sorted = [...projects].sort((a, b) => (a.deliveryProgress ?? 0) - (b.deliveryProgress ?? 0));
  const maxBudget = Math.max(...projects.map(p => p.dwhBudget ?? 0), 1);

  return (
    <div className="space-y-6">
      {/* Row 1: Delivery bars + Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Delivery progress bars */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Delivery Progress by Project</p>
          <div className="space-y-2.5">
            {sorted.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-600 w-36 shrink-0 truncate" title={p.symbol.trim()}>
                  {p.symbol.trim()}
                </span>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.deliveryProgress ?? 0}%`, backgroundColor: RISK_STYLE[p.level].bar }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-8 text-right shrink-0">{p.deliveryProgress ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scatter: Days remaining vs Delivery % */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Delivery % vs Time Remaining</p>
          <p className="text-xs text-slate-400 mb-3">Each dot is a project — bottom-left = most critical</p>
          <ScatterChart projects={projects} />
        </div>
      </div>

      {/* Row 2: Budget bars */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print-break">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Budget Overview (Total vs Available)</p>
        <div className="space-y-3">
          {[...projects].sort((a, b) => (b.dwhBudget ?? 0) - (a.dwhBudget ?? 0)).filter(p => p.dwhBudget > 0).map(p => {
            const availPct = Math.min(100, ((p.availableBudget ?? 0) / (p.dwhBudget ?? 1)) * 100);
            const budgetBarW = ((p.dwhBudget ?? 0) / maxBudget) * 100;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-600 w-36 shrink-0 truncate">{p.symbol.trim()}</span>
                <div className="flex-1 relative h-4 bg-slate-100 rounded-full overflow-hidden">
                  {/* Total budget bar (scaled to max) */}
                  <div className="absolute inset-y-0 left-0 bg-blue-100 rounded-full" style={{ width: `${budgetBarW}%` }} />
                  {/* Available within total */}
                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full" style={{ width: `${budgetBarW * availPct / 100}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-32 text-right shrink-0 whitespace-nowrap">
                  <span className="text-blue-600 font-medium">{fmt(p.availableBudget ?? 0)}</span>
                  <span className="text-slate-400"> / {fmt(p.dwhBudget ?? 0)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-blue-100 inline-block" /> Total budget</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Available</span>
        </div>
      </div>

      {/* Row 3: Delivery by LTO */}
      <LtoDeliveryChart projects={projects} />
    </div>
  );
}

// ── Scatter chart (SVG) ───────────────────────────────────────────────────────

function ScatterChart({ projects }: { projects: EnrichedProject[] }) {
  const [hovered, setHovered] = useState<EnrichedProject | null>(null);
  const W = 380, H = 260, PAD = { top: 10, right: 10, bottom: 36, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // x = days left (0–730), y = delivery % (0–100)
  const maxDays = 730;
  const toX = (d: number | null) => PAD.left + Math.min(Math.max(d ?? 0, 0), maxDays) / maxDays * innerW;
  const toY = (pct: number) => PAD.top + innerH - (Math.min(Math.max(pct, 0), 100) / 100 * innerH);

  // Quadrant lines
  const midX = toX(365);
  const midY = toY(50);

  const xTicks = [0, 180, 365, 548, 730];
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Quadrant backgrounds */}
        <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="#fef2f2" opacity="0.5" />
        <rect x={PAD.left} y={midY} width={midX - PAD.left} height={PAD.top + innerH - midY} fill="#fff7ed" opacity="0.5" />
        <rect x={midX} y={PAD.top} width={PAD.left + innerW - midX} height={midY - PAD.top} fill="#f0fdf4" opacity="0.5" />
        <rect x={midX} y={midY} width={PAD.left + innerW - midX} height={PAD.top + innerH - midY} fill="#fffbeb" opacity="0.4" />

        {/* Grid lines */}
        {yTicks.map(t => (
          <line key={t} x1={PAD.left} x2={PAD.left + innerW} y1={toY(t)} y2={toY(t)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {xTicks.map(t => (
          <line key={t} x1={toX(t)} x2={toX(t)} y1={PAD.top} y2={PAD.top + innerH} stroke="#e2e8f0" strokeWidth="1" />
        ))}

        {/* Quadrant dividers */}
        <line x1={midX} x2={midX} y1={PAD.top} y2={PAD.top + innerH} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1={PAD.left} x2={PAD.left + innerW} y1={midY} y2={midY} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Axis labels */}
        {yTicks.map(t => (
          <text key={t} x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{t}%</text>
        ))}
        {xTicks.map(t => (
          <text key={t} x={toX(t)} y={PAD.top + innerH + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{t}d</text>
        ))}

        {/* Axis titles */}
        <text x={PAD.left + innerW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#64748b">Days remaining</text>
        <text x={10} y={PAD.top + innerH / 2} textAnchor="middle" fontSize="9" fill="#64748b" transform={`rotate(-90 10 ${PAD.top + innerH / 2})`}>Delivery %</text>

        {/* Quadrant labels */}
        <text x={PAD.left + 6} y={PAD.top + 14} fontSize="8" fill="#ef4444" opacity="0.7">Critical zone</text>
        <text x={midX + 6} y={PAD.top + 14} fontSize="8" fill="#2e7d32" opacity="0.7">On track</text>

        {/* Dots */}
        {projects.map(p => {
          const cx = toX(p.daysLeft);
          const cy = toY(p.deliveryProgress ?? 0);
          const isHovered = hovered?.id === p.id;
          return (
            <g key={p.id}>
              <circle
                cx={cx} cy={cy} r={isHovered ? 8 : 6}
                fill={RISK_STYLE[p.level].dot}
                stroke="white" strokeWidth="1.5"
                style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                opacity={0.85}
              />
              {isHovered && (
                <text x={cx} y={cy - 10} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="600">
                  {p.symbol.trim().split('/').slice(-1)[0]?.trim()}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-52 pointer-events-none">
          <div className="font-semibold text-slate-800 mb-1">{hovered.symbol.trim()}</div>
          <div className="text-slate-500 leading-snug mb-1 line-clamp-2">{hovered.title}</div>
          <div className="flex gap-3">
            <span>Delivery: <strong>{hovered.deliveryProgress ?? 0}%</strong></span>
            <span>Days: <strong>{hovered.daysLeft ?? '—'}</strong></span>
          </div>
          <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${RISK_STYLE[hovered.level].badge}`}>{hovered.level}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {RISK_ORDER.filter(r => r !== 'N/A').map(r => (
          <span key={r} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: RISK_STYLE[r].dot }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Delivery by LTO ───────────────────────────────────────────────────────────

function LtoDeliveryChart({ projects }: { projects: EnrichedProject[] }) {
  const byLto = useMemo(() => {
    const map = new Map<string, EnrichedProject[]>();
    for (const p of projects) {
      const lto = p.ltoOfficer.split('(')[0].trim() || 'Unknown';
      if (!map.has(lto)) map.set(lto, []);
      map.get(lto)!.push(p);
    }
    return Array.from(map.entries())
      .map(([lto, ps]) => ({
        lto,
        count: ps.length,
        avg: Math.round(ps.reduce((s, p) => s + (p.deliveryProgress ?? 0), 0) / ps.length),
        budget: ps.reduce((s, p) => s + (p.dwhBudget ?? 0), 0),
        projects: ps,
      }))
      .sort((a, b) => a.avg - b.avg);
  }, [projects]);

  if (byLto.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Average Delivery by Project Manager</p>
      <div className="space-y-4">
        {byLto.map(({ lto, avg, budget, projects: ps }) => (
          <div key={lto}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">{lto}</span>
              <span className="text-xs text-slate-500">{ps.length} project{ps.length !== 1 ? 's' : ''} · {fmt(budget)} total</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${avg}%`,
                    backgroundColor: avg >= 75 ? '#2e7d32' : avg >= 40 ? '#007bc0' : '#f59e0b',
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-8 text-right">{avg}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, bg }: { icon: React.ReactNode; label: string; value: string; sub?: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-slate-200`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProjectMultiSelect({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (sym: string) => onChange(selected.includes(sym) ? selected.filter(s => s !== sym) : [...selected, sym]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} className="input-sm w-full flex items-center justify-between text-left">
        <span className="truncate text-slate-600 text-xs">
          {selected.length === 0 ? 'All projects' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-slate-50 border-b border-slate-100">
              Clear selection
            </button>
          )}
          {options.map(sym => (
            <label key={sym} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(sym)} onChange={() => toggle(sym)} className="rounded" />
              <span className="text-xs font-mono text-slate-700">{sym}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
