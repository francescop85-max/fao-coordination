'use client';

import { useEffect, useRef, useState } from 'react';
import { store } from '../store';
import { Project, WorkPlan } from '../types';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, X, Check, Upload, AlertCircle, CheckSquare, Square, ClipboardList, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = [
  'Operationally Active',
  'Activities Completed',
  'Operationally Closed',
  'Active Pipeline',
];

const STATUS_COLORS: Record<string, string> = {
  'Operationally Active': 'bg-green-100 text-green-800',
  'Activities Completed': 'bg-blue-100 text-blue-800',
  'Operationally Closed': 'bg-slate-100 text-slate-600',
  'Active Pipeline': 'bg-amber-100 text-amber-800',
};

const EMPTY_PROJECT: Omit<Project, 'id'> = {
  symbol: '', title: '', status: 'Operationally Active', eod: '', nte: '',
  dwhBudget: 0, availableBudget: 0, hardCommitment: 0, softCommitment: 0,
  cashBalance: 0, deliveryLastMonth: 0, durationYears: 0,
  ltoOfficer: '', alternateLto: '', operationModalities: '', donors: '',
  estimate2027: 0, deliveryProgress: 0, projectManager: '',
};

// Parse a row array into a Project using the FPMIS column order:
// [0] Entity, [1] Symbol, [2] Title, [3] Status, [4] EOD, [5] NTE,
// [6] DWH Budget, [7] Available Budget, [8] Hard cmt, [9] Soft cmt,
// [10] Cash balance, [11] Delivery last month, [12] Duration,
// [13] LTO Officer, [14] Alternate LTO, [15] Op. modalities,
// [16] Donor(s), [17] Estimate 2027, [18] Delivery %
function rowToProject(row: (string | number)[]): Omit<Project, 'id'> | null {
  const str = (i: number) => String(row[i] ?? '').trim();
  const num = (i: number) => {
    const v = row[i];
    return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
  };
  const symbol = str(1);
  const title = str(2);
  if (!symbol || !title) return null;
  return {
    symbol,
    title,
    status: str(3),
    eod: str(4),
    nte: str(5),
    dwhBudget: num(6),
    availableBudget: num(7),
    hardCommitment: num(8),
    softCommitment: num(9),
    cashBalance: num(10),
    deliveryLastMonth: num(11),
    durationYears: num(12),
    ltoOfficer: str(13),
    alternateLto: str(14),
    operationModalities: str(15),
    donors: str(16),
    estimate2027: num(17),
    deliveryProgress: num(18),
    projectManager: str(19),
  };
}

function parseFile(file: File): Promise<Omit<Project, 'id'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const rows: (string | number)[][] = XLSX.utils.sheet_to_json(sh, { header: 1 });

        // Find the header row: look for a row where col[1] === 'Symbol'
        let dataStart = 1; // default: row 1 is headers, row 2+ is data
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (String(rows[i]?.[1] ?? '').trim() === 'Symbol') {
            dataStart = i + 1;
            break;
          }
        }

        const projects: Omit<Project, 'id'>[] = [];
        for (let i = dataStart; i < rows.length; i++) {
          const p = rowToProject(rows[i]);
          if (p) projects.push(p);
        }
        resolve(projects);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

interface ImportPreview {
  added: Omit<Project, 'id'>[];
  updated: { prev: Project; next: Omit<Project, 'id'> }[];
  unchanged: number;
}

function diffImport(existing: Project[], incoming: Omit<Project, 'id'>[]): ImportPreview {
  const bySymbol = new Map(existing.map(p => [p.symbol.trim(), p]));
  const added: Omit<Project, 'id'>[] = [];
  const updated: { prev: Project; next: Omit<Project, 'id'> }[] = [];
  let unchanged = 0;

  for (const p of incoming) {
    const sym = p.symbol.trim();
    const existing = bySymbol.get(sym);
    if (!existing) {
      added.push(p);
    } else if (
      existing.status.trim() !== p.status.trim() ||
      existing.nte !== p.nte ||
      existing.ltoOfficer !== p.ltoOfficer ||
      existing.donors !== p.donors ||
      existing.dwhBudget !== p.dwhBudget ||
      existing.deliveryProgress !== p.deliveryProgress
    ) {
      updated.push({ prev: existing, next: p });
    } else {
      unchanged++;
    }
  }

  return { added, updated, unchanged };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [sortCol, setSortCol] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPM, setFilterPM] = useState('');
  const [filterDonor, setFilterDonor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Omit<Project, 'id'>>(EMPTY_PROJECT);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<Omit<Project, 'id'>[]>([]);
  const [importError, setImportError] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setProjects(await store.getProjects());
      setWorkPlans(await store.getWorkPlans());
    };
    load();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportFilename(file.name);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setImportError('No valid project rows found. Check the file structure matches the FPMIS export format.');
        return;
      }
      setImportData(parsed);
      setImportPreview(diffImport(projects, parsed));
    } catch {
      setImportError('Could not read file. Make sure it is a valid .xls, .xlsx or .csv file.');
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    // Apply updates — save each changed project by its existing id
    for (const { prev, next } of importPreview.updated) {
      await store.saveProject({ ...next, id: prev.id });
    }
    // Add new — server assigns IDs
    for (const p of importPreview.added) {
      await store.createProject(p);
    }
    setProjects(await store.getProjects());
    setImportPreview(null);
    setImportData([]);
    setImportFilename('');
  };

  const pmOptions = Array.from(new Set(
    projects.map(p => (p.projectManager ?? '').split('(')[0].trim()).filter(Boolean)
  )).sort();

  const donorOptions = Array.from(new Set(
    projects.map(p => p.donors).filter(Boolean)
  )).sort();

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.symbol.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
      || p.ltoOfficer.toLowerCase().includes(q) || p.donors.toLowerCase().includes(q)
      || (p.projectManager ?? '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || p.status.trim() === filterStatus;
    const matchPM = !filterPM || (p.projectManager ?? '').includes(filterPM);
    const matchDonor = !filterDonor || p.donors === filterDonor;
    return matchSearch && matchStatus && matchPM && matchDonor;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortCol === 'symbol')          { av = a.symbol.trim();                      bv = b.symbol.trim(); }
    else if (sortCol === 'title')      { av = a.title;                              bv = b.title; }
    else if (sortCol === 'status')     { av = a.status.trim();                      bv = b.status.trim(); }
    else if (sortCol === 'lto')        { av = a.ltoOfficer.split('(')[0].trim();    bv = b.ltoOfficer.split('(')[0].trim(); }
    else if (sortCol === 'pm')         { av = (a.projectManager ?? '').split('(')[0].trim(); bv = (b.projectManager ?? '').split('(')[0].trim(); }
    else if (sortCol === 'donor')      { av = a.donors;                             bv = b.donors; }
    else if (sortCol === 'nte')        { av = a.nte;                                bv = b.nte; }
    else if (sortCol === 'delivery')   { av = a.deliveryProgress ?? 0;              bv = b.deliveryProgress ?? 0; }
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const startEdit = (p: Project) => { setEditingId(p.id); setForm({ ...p }); setShowAdd(false); };
  const cancelEdit = () => setEditingId(null);
  const commitEdit = async () => {
    if (!editingId) return;
    await store.saveProject({ ...form, id: editingId });
    setProjects(await store.getProjects());
    setEditingId(null);
  };
  const startAdd = () => { setForm({ ...EMPTY_PROJECT }); setShowAdd(true); setEditingId(null); };
  const commitAdd = async () => {
    await store.createProject(form);
    setProjects(await store.getProjects());
    setShowAdd(false);
  };
  const deleteProject = async (id: string) => {
    await store.deleteProject(id);
    setProjects(await store.getProjects());
    setDeleteConfirm(null);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.delete(p.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.add(p.id)); return s; });
    }
  };
  const deleteSelected = async () => {
    for (const id of selected) {
      await store.deleteProject(id);
    }
    setProjects(await store.getProjects());
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };
  const f = (field: keyof typeof form, val: string | number) => setForm(prev => ({ ...prev, [field]: val }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Project Registry</h1>
          <p className="text-slate-500 text-sm">
            {projects.length} projects · {projects.filter(p => p.status.includes('Active') && !p.status.includes('Pipeline')).length} operationally active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-sm px-4 py-2 rounded-lg font-medium border border-slate-200 transition-colors"
          >
            <Upload size={15} /> Import FPMIS
          </button>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#006aa0] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={15} /> Add Project
          </button>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{importError}</span>
          <button onClick={() => setImportError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Import preview modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Import Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">{importFilename}</p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {/* Summary pills */}
              <div className="flex gap-3 flex-wrap">
                <span className="text-xs font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full">
                  {importPreview.added.length} new project{importPreview.added.length !== 1 ? 's' : ''} to add
                </span>
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                  {importPreview.updated.length} project{importPreview.updated.length !== 1 ? 's' : ''} to update
                </span>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                  {importPreview.unchanged} unchanged
                </span>
              </div>

              {/* New projects */}
              {importPreview.added.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">New projects</p>
                  <ul className="space-y-1">
                    {importPreview.added.map(p => (
                      <li key={p.symbol} className="flex items-center gap-2 text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        <span className="font-mono text-xs text-slate-700 font-medium">{p.symbol}</span>
                        <span className="text-slate-500 truncate flex-1">{p.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Updated projects */}
              {importPreview.updated.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Projects with changes</p>
                  <ul className="space-y-2">
                    {importPreview.updated.map(({ prev, next }) => (
                      <li key={prev.symbol} className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-1">
                        <span className="font-mono font-medium text-slate-700">{prev.symbol.trim()}</span>
                        {prev.status.trim() !== next.status.trim() && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>Status:</span>
                            <span className="line-through text-red-400">{prev.status.trim()}</span>
                            <span>→</span>
                            <span className="text-green-700 font-medium">{next.status.trim()}</span>
                          </div>
                        )}
                        {prev.nte !== next.nte && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>NTE:</span>
                            <span className="line-through text-red-400">{prev.nte}</span>
                            <span>→</span>
                            <span className="text-green-700 font-medium">{next.nte}</span>
                          </div>
                        )}
                        {prev.ltoOfficer !== next.ltoOfficer && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>LTO:</span>
                            <span className="line-through text-red-400">{prev.ltoOfficer.split('(')[0].trim()}</span>
                            <span>→</span>
                            <span className="text-green-700 font-medium">{next.ltoOfficer.split('(')[0].trim()}</span>
                          </div>
                        )}
                        {prev.donors !== next.donors && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>Donor:</span>
                            <span className="line-through text-red-400">{prev.donors}</span>
                            <span>→</span>
                            <span className="text-green-700 font-medium">{next.donors}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.added.length === 0 && importPreview.updated.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">All projects are already up to date — nothing to import.</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importPreview.added.length === 0 && importPreview.updated.length === 0}
                className="px-4 py-2 text-sm bg-[#007bc0] text-white rounded-lg hover:bg-[#006aa0] transition-colors font-medium disabled:opacity-50"
              >
                Apply {importPreview.added.length + importPreview.updated.length} change{importPreview.added.length + importPreview.updated.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search symbol, title, LTO, PM, donor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPM} onChange={e => setFilterPM(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All project managers</option>
          {pmOptions.map(pm => <option key={pm} value={pm}>{pm}</option>)}
        </select>
        <select value={filterDonor} onChange={e => setFilterDonor(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">All donors</option>
          {donorOptions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-slate-800 text-white rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} project{selected.size !== 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white text-xs ml-1">Clear</button>
          <div className="flex-1" />
          {bulkDeleteConfirm ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-300">Delete {selected.size} project{selected.size !== 1 ? 's' : ''}?</span>
              <button onClick={deleteSelected} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-sm font-medium transition-colors">Confirm</button>
              <button onClick={() => setBulkDeleteConfirm(false)} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded-lg text-sm transition-colors">Cancel</button>
            </span>
          ) : (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 size={13} /> Delete selected
            </button>
          )}
        </div>
      )}

      {/* Add row */}
      {showAdd && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-blue-800 mb-3">New Project</h3>
          <ProjectForm form={form} onChange={f} onSave={commitAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-8">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {allFilteredSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                  </button>
                </th>
                {([
                  { col: 'symbol',   label: 'Symbol',          cls: 'w-36' },
                  { col: 'title',    label: 'Title',            cls: '' },
                  { col: 'status',   label: 'Status',           cls: 'w-36' },
                  { col: 'lto',      label: 'LTO Officer',      cls: 'w-28' },
                  { col: 'pm',       label: 'Project Manager',  cls: 'w-28' },
                  { col: 'donor',    label: 'Donor(s)',         cls: 'w-24' },
                  { col: 'nte',      label: 'NTE',              cls: 'w-24' },
                  { col: 'delivery', label: 'Delivery',         cls: 'w-24' },
                ] as { col: string; label: string; cls: string }[]).map(({ col, label, cls }) => (
                  <th key={col} className={`px-4 py-3 ${cls}`}>
                    <button
                      onClick={() => toggleSort(col)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors group"
                    >
                      {label}
                      <span className="text-slate-300 group-hover:text-slate-500">
                        {sortCol === col
                          ? sortDir === 'asc' ? <ChevronUp size={13} className="text-blue-500" /> : <ChevronDown size={13} className="text-blue-500" />
                          : <ChevronsUpDown size={13} />}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Work Plan</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400 text-sm">No projects found</td></tr>
              )}
              {sorted.map(p => (
                editingId === p.id ? (
                  <tr key={p.id} className="bg-amber-50">
                    <td colSpan={11} className="px-4 py-4">
                      <ProjectForm form={form} onChange={f} onSave={commitEdit} onCancel={cancelEdit} />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={`transition-colors ${selected.has(p.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(p.id)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        {selected.has(p.id) ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{p.symbol.trim()}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs"><div className="line-clamp-2">{p.title}</div></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status.trim()] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.status.trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.ltoOfficer.split('(')[0].trim()}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{(p.projectManager ?? '').split('(')[0].trim()}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-24">{p.donors}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.nte}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.deliveryProgress ?? 0}%`, backgroundColor: (p.deliveryProgress ?? 0) >= 75 ? '#2e7d32' : (p.deliveryProgress ?? 0) >= 40 ? '#007bc0' : '#f59e0b' }} />
                        </div>
                        <span className="text-xs text-slate-500">{p.deliveryProgress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {workPlans.some(wp => wp.projectId === p.id) ? (
                        <Link
                          href="/workplans"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="View work plan"
                        >
                          <ClipboardList size={11} /> Yes
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(p)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {deleteConfirm === p.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => deleteProject(p.id)} className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"><Check size={13} /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><X size={13} /></button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteConfirm(p.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProjectForm({
  form, onChange, onSave, onCancel,
}: {
  form: Omit<Project, 'id'>;
  onChange: (field: keyof Omit<Project, 'id'>, val: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Symbol *</label>
          <input className="input-sm w-full" value={form.symbol} onChange={e => onChange('symbol', e.target.value)} placeholder="e.g. OSRO/UKR/001/XXX" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input className="input-sm w-full" value={form.title} onChange={e => onChange('title', e.target.value)} placeholder="Project title" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select className="input-sm w-full" value={form.status} onChange={e => onChange('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">LTO Officer</label>
          <input className="input-sm w-full" value={form.ltoOfficer} onChange={e => onChange('ltoOfficer', e.target.value)} placeholder="Name (unit)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project Manager</label>
          <input className="input-sm w-full" value={form.projectManager} onChange={e => onChange('projectManager', e.target.value)} placeholder="Name (unit)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Donor(s)</label>
          <input className="input-sm w-full" value={form.donors} onChange={e => onChange('donors', e.target.value)} placeholder="e.g. European Union" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">EOD (start)</label>
          <input className="input-sm w-full" value={form.eod} onChange={e => onChange('eod', e.target.value)} placeholder="DD/MM/YYYY" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">NTE (end)</label>
          <input className="input-sm w-full" value={form.nte} onChange={e => onChange('nte', e.target.value)} placeholder="DD/MM/YYYY" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">DWH Budget (USD)</label>
          <input type="number" className="input-sm w-full" value={form.dwhBudget} onChange={e => onChange('dwhBudget', Number(e.target.value))} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Operation Modalities</label>
          <input className="input-sm w-full" value={form.operationModalities} onChange={e => onChange('operationModalities', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={onSave} className="px-3 py-1.5 text-sm bg-[#007bc0] text-white rounded-lg hover:bg-[#006aa0] transition-colors font-medium">Save</button>
      </div>
    </div>
  );
}
