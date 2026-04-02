'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { store } from '../store';
import { WorkPlan, WorkTask, Project, TaskStatus, TaskPriority } from '../types';
import {
  Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, Check,
  ClipboardList, LayoutDashboard, ListChecks, BarChart2, ArrowLeft,
  GitBranch, AlertCircle, Clock, TrendingUp, CheckCircle2,
  Upload, Download, FileSpreadsheet, AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  STATUS_COLORS, STATUS_BG, STATUS_LABELS,
  PRIORITY_BG, PRIORITY_LABELS, PRIORITY_COLORS,
  ALL_STATUSES, ALL_PRIORITIES,
} from './constants';
import GanttChart from '../components/GanttChart';

// ─── Excel import helpers ────────────────────────────────────────────────────

const VALID_STATUSES = new Set<TaskStatus>(['not-started', 'in-progress', 'completed', 'delayed']);
const VALID_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'critical']);

interface ParsedRow {
  taskNum: number;
  title: string;
  description: string;
  assignee: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  depNums: number[]; // task # references, resolved to ids after parsing
}

interface ImportPreview {
  rows: ParsedRow[];
  warnings: string[];
}

function normaliseDate(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  // Try JS Date parse (e.g. "05/15/2026")
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return s;
}

function parseWorkplanFile(file: File): Promise<ImportPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array', cellDates: false });

        // Find the "Work Plan" sheet, fall back to first sheet
        const sheetName = wb.SheetNames.find(n => /work.?plan/i.test(n)) ?? wb.SheetNames[0];
        const sh = wb.Sheets[sheetName];
        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });

        // Find header row: look for a row containing "Title"
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i].some(c => String(c ?? '').toLowerCase().includes('title'))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx < 0) {
          reject(new Error('Could not find a header row with "Title". Make sure you are using the FAO template.'));
          return;
        }

        const headers = rows[headerIdx].map(h => String(h ?? '').toLowerCase());
        const col = (keyword: string) => headers.findIndex(h => h.includes(keyword));

        const colTaskNum   = col('task #') >= 0 ? col('task #') : col('task#') >= 0 ? col('task#') : col('#');
        const colTitle     = col('title');
        const colDesc      = col('description');
        const colAssignee  = col('assignee');
        const colStart     = col('start');
        const colEnd       = col('end');
        const colStatus    = col('status');
        const colPriority  = col('priority');
        const colProgress  = col('progress');
        const colDeps      = col('dependenc');

        if (colTitle < 0) {
          reject(new Error('Could not find a "Title" column in the file.'));
          return;
        }

        const parsed: ParsedRow[] = [];
        const warnings: string[] = [];
        let autoNum = 1;

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const title = String(row[colTitle] ?? '').trim();
          if (!title) continue; // skip empty rows

          const taskNum = colTaskNum >= 0 && row[colTaskNum] != null
            ? Number(row[colTaskNum])
            : autoNum;
          autoNum = taskNum + 1;

          const rawStatus = String(row[colStatus] ?? '').trim().toLowerCase();
          const status: TaskStatus = VALID_STATUSES.has(rawStatus as TaskStatus)
            ? (rawStatus as TaskStatus)
            : 'not-started';
          if (rawStatus && !VALID_STATUSES.has(rawStatus as TaskStatus)) {
            warnings.push(`Row ${i + 1}: unrecognised status "${rawStatus}", defaulted to "not-started".`);
          }

          const rawPriority = String(row[colPriority] ?? '').trim().toLowerCase();
          const priority: TaskPriority = VALID_PRIORITIES.has(rawPriority as TaskPriority)
            ? (rawPriority as TaskPriority)
            : 'medium';
          if (rawPriority && !VALID_PRIORITIES.has(rawPriority as TaskPriority)) {
            warnings.push(`Row ${i + 1}: unrecognised priority "${rawPriority}", defaulted to "medium".`);
          }

          const rawProgress = colProgress >= 0 ? row[colProgress] : null;
          const progress = Math.min(100, Math.max(0, Number(rawProgress ?? 0) || 0));

          const rawDeps = colDeps >= 0 ? String(row[colDeps] ?? '').trim() : '';
          const depNums = rawDeps
            ? rawDeps.split(/[,;]+/).map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
            : [];

          const startDate = colStart >= 0 ? normaliseDate(row[colStart]) : '';
          const endDate   = colEnd   >= 0 ? normaliseDate(row[colEnd])   : '';

          if (startDate && endDate && startDate > endDate) {
            warnings.push(`Row ${i + 1} (${title}): start date is after end date.`);
          }

          parsed.push({
            taskNum,
            title,
            description: colDesc >= 0 ? String(row[colDesc] ?? '').trim() : '',
            assignee:    colAssignee >= 0 ? String(row[colAssignee] ?? '').trim() : '',
            startDate,
            endDate,
            status,
            priority,
            progress,
            depNums,
          });
        }

        if (parsed.length === 0) {
          reject(new Error('No tasks found in the file. Make sure the Work Plan sheet has data rows below the header.'));
          return;
        }

        // Validate dependency references
        const knownNums = new Set(parsed.map(p => p.taskNum));
        parsed.forEach((p, idx) => {
          p.depNums.forEach(n => {
            if (!knownNums.has(n)) {
              warnings.push(`Task "${p.title}": dependency Task #${n} not found in file — it will be ignored.`);
              // Remove invalid dep
              parsed[idx].depNums = parsed[idx].depNums.filter(d => d !== n);
            }
          });
        });

        resolve({ rows: parsed, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function previewToTasks(preview: ImportPreview, workPlanId: string, projectId: string): WorkTask[] {
  // Assign stable ids
  const numToId = new Map<number, string>();
  const base = Date.now();
  preview.rows.forEach((row, i) => {
    numToId.set(row.taskNum, `${base + i}`);
  });

  return preview.rows.map((row, i) => ({
    id: `${base + i}`,
    workPlanId,
    projectId,
    title: row.title,
    description: row.description,
    assignee: row.assignee,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    priority: row.priority,
    progress: row.progress,
    dependencies: row.depNums.map(n => numToId.get(n)!).filter(Boolean),
  }));
}

// ─── Import Preview Modal ────────────────────────────────────────────────────

function ImportModal({
  preview,
  filename,
  onConfirm,
  onCancel,
  mode,
  setMode,
}: {
  preview: ImportPreview;
  filename: string;
  onConfirm: (mode: 'replace' | 'merge') => void;
  onCancel: () => void;
  mode: 'replace' | 'merge';
  setMode: (m: 'replace' | 'merge') => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-green-600" />
              Import Preview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{filename} · {preview.rows.length} task{preview.rows.length !== 1 ? 's' : ''} found</p>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                <AlertTriangle size={14} />
                {preview.warnings.length} warning{preview.warnings.length > 1 ? 's' : ''}
              </div>
              <ul className="space-y-0.5">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import mode */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">Import mode</p>
            <div className="flex gap-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Replace tasks</div>
                  <div className="text-xs text-slate-400">Remove all existing tasks and replace with imported ones</div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Add to existing</div>
                  <div className="text-xs text-slate-400">Keep current tasks and append the imported ones</div>
                </div>
              </label>
            </div>
          </div>

          {/* Task list preview */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Tasks to import</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-slate-500 font-medium w-6">#</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Title</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium hidden sm:table-cell">Dates</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Status</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium hidden sm:table-cell">Priority</th>
                    <th className="text-right px-3 py-2 text-slate-500 font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50">
                      <td className="px-3 py-2 text-slate-400">{row.taskNum}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {row.title}
                        {row.depNums.length > 0 && (
                          <span className="ml-1.5 text-slate-400">
                            <GitBranch size={9} className="inline" /> {row.depNums.join(',')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                        {row.startDate && row.endDate
                          ? `${row.startDate} → ${row.endDate}`
                          : row.startDate || row.endDate || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_BG[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize text-slate-500 hidden sm:table-cell">{row.priority}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{row.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode)}
            className="flex items-center gap-2 px-5 py-2 bg-[#003f7d] text-white text-sm rounded-lg hover:bg-[#002d5a]"
          >
            <Check size={14} /> Import {preview.rows.length} task{preview.rows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function derivePlanStatus(tasks: WorkTask[]): TaskStatus {
  if (tasks.length === 0) return 'not-started';
  if (tasks.some(t => t.status === 'delayed')) return 'delayed';
  if (tasks.every(t => t.status === 'completed')) return 'completed';
  if (tasks.some(t => t.status === 'in-progress' || t.status === 'completed')) return 'in-progress';
  return 'not-started';
}

function planCompletion(tasks: WorkTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);
}

const EMPTY_TASK = (): Omit<WorkTask, 'id' | 'workPlanId' | 'projectId'> => ({
  title: '', description: '', startDate: '', endDate: '',
  status: 'not-started', progress: 0, priority: 'medium',
  dependencies: [], assignee: '',
});

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BG[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BG[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

// ─── Work Plan Dashboard tab ─────────────────────────────────────────────────

function PlanDashboard({ plan }: { plan: WorkPlan }) {
  const tasks = plan.tasks;
  const today = new Date();

  const byStatus = useMemo(() => {
    const counts: Record<TaskStatus, number> = { 'not-started': 0, 'in-progress': 0, 'completed': 0, 'delayed': 0 };
    tasks.forEach(t => counts[t.status]++);
    return counts;
  }, [tasks]);

  const byPriority = useMemo(() => {
    const counts: Record<TaskPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    tasks.forEach(t => counts[t.priority]++);
    return counts;
  }, [tasks]);

  const upcoming = tasks
    .filter(t => t.status !== 'completed' && t.endDate)
    .filter(t => {
      const d = differenceInDays(parseISO(t.endDate), today);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const blocked = tasks.filter(t => {
    if (t.dependencies.length === 0) return false;
    const taskMap = new Map(tasks.map(x => [x.id, x]));
    return t.dependencies.some(depId => {
      const dep = taskMap.get(depId);
      return dep && dep.status !== 'completed';
    });
  });

  const completion = planCompletion(tasks);

  const statCards = [
    { label: 'Total Tasks', value: tasks.length, icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: byStatus['completed'], icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'In Progress', value: byStatus['in-progress'], icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Delayed', value: byStatus['delayed'], icon: AlertCircle, color: byStatus['delayed'] > 0 ? 'text-red-600' : 'text-slate-400', bg: byStatus['delayed'] > 0 ? 'bg-red-50' : 'bg-slate-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-slate-700">Overall Completion</span>
          <span className="font-semibold text-slate-800">{completion}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${completion}%`, backgroundColor: completion === 100 ? '#2e7d32' : '#007bc0' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Status Breakdown</h3>
          <div className="space-y-2">
            {ALL_STATUSES.map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-28 text-xs text-slate-600 truncate">{STATUS_LABELS[s]}</div>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: tasks.length > 0 ? `${(byStatus[s] / tasks.length) * 100}%` : '0%',
                      backgroundColor: STATUS_COLORS[s],
                    }}
                  />
                </div>
                <div className="w-6 text-xs text-right text-slate-600 font-medium">{byStatus[s]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Priority Breakdown</h3>
          <div className="space-y-2">
            {ALL_PRIORITIES.map(p => (
              <div key={p} className="flex items-center gap-2">
                <div className="w-28 text-xs text-slate-600 truncate capitalize">{PRIORITY_LABELS[p]}</div>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: tasks.length > 0 ? `${(byPriority[p] / tasks.length) * 100}%` : '0%',
                      backgroundColor: PRIORITY_COLORS[p],
                    }}
                  />
                </div>
                <div className="w-6 text-xs text-right text-slate-600 font-medium">{byPriority[p]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upcoming deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Clock size={14} className="text-orange-500" />
            Deadlines in the next 7 days
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No upcoming deadlines</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(t => {
                const daysLeft = differenceInDays(parseISO(t.endDate), today);
                return (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <div className="flex-1 truncate text-slate-700">{t.title}</div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <StatusBadge status={t.status} />
                      <span className={`font-medium ${daysLeft <= 1 ? 'text-red-600' : daysLeft <= 3 ? 'text-orange-500' : 'text-slate-500'}`}>
                        {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Blocked tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <GitBranch size={14} className="text-slate-500" />
            Blocked Tasks
          </h3>
          {blocked.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No blocked tasks</p>
          ) : (
            <div className="space-y-2">
              {blocked.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <div className="flex-1 truncate text-slate-700">{t.title}</div>
                  <span className="text-slate-400 shrink-0 ml-2">{t.dependencies.length} dep{t.dependencies.length > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Form ───────────────────────────────────────────────────────────────

function TaskForm({
  form, setForm, tasks, onSave, onCancel, editingId,
}: {
  form: Omit<WorkTask, 'id' | 'workPlanId' | 'projectId'>;
  setForm: (f: Omit<WorkTask, 'id' | 'workPlanId' | 'projectId'>) => void;
  tasks: WorkTask[];
  onSave: () => void;
  onCancel: () => void;
  editingId: string | null;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">{editingId ? 'Edit Task' : 'Add Task'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Task title"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white resize-none"
            rows={2}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Assignee</label>
          <input
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.assignee}
            onChange={e => setForm({ ...form, assignee: e.target.value })}
            placeholder="Assignee name"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
            <input
              type="date"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
            <input
              type="date"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
              value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}
          >
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
          <select
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}
          >
            {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Progress: {form.progress}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            className="w-full"
            value={form.progress}
            onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
          />
        </div>
        {tasks.length > 0 && (
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dependencies</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg bg-white p-2 space-y-1">
              {tasks.filter(t => t.id !== editingId).map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.dependencies.includes(t.id)}
                    onChange={e => {
                      const deps = e.target.checked
                        ? [...form.dependencies, t.id]
                        : form.dependencies.filter(id => id !== t.id);
                      setForm({ ...form, dependencies: deps });
                    }}
                  />
                  <span className="text-slate-700">{t.title}</span>
                  <StatusBadge status={t.status} />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onSave}
          disabled={!form.title.trim() || !form.startDate || !form.endDate}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#003f7d] text-white text-sm rounded-lg hover:bg-[#002d5a] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={14} /> {editingId ? 'Update' : 'Add Task'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Tasks Tab ───────────────────────────────────────────────────────────────

function TasksTab({ plan, onUpdate }: { plan: WorkPlan; onUpdate: (plan: WorkPlan) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<WorkTask, 'id' | 'workPlanId' | 'projectId'>>(EMPTY_TASK());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'startDate' | 'endDate' | 'priority' | 'status'>('startDate');

  const taskMap = useMemo(() => new Map(plan.tasks.map(t => [t.id, t])), [plan.tasks]);

  const sorted = useMemo(() => {
    const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...plan.tasks].sort((a, b) => {
      if (sortBy === 'startDate') return a.startDate.localeCompare(b.startDate);
      if (sortBy === 'endDate') return a.endDate.localeCompare(b.endDate);
      if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
  }, [plan.tasks, sortBy]);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_TASK());
    setShowForm(true);
  };

  const startEdit = (task: WorkTask) => {
    setEditingId(task.id);
    setForm({
      title: task.title, description: task.description,
      startDate: task.startDate, endDate: task.endDate,
      status: task.status, progress: task.progress,
      priority: task.priority, dependencies: task.dependencies,
      assignee: task.assignee,
    });
    setShowForm(true);
  };

  const saveTask = () => {
    const now = new Date().toISOString();
    if (editingId) {
      const tasks = plan.tasks.map(t =>
        t.id === editingId ? { ...t, ...form } : t
      );
      onUpdate({ ...plan, tasks, lastUpdated: now });
    } else {
      const newTask: WorkTask = {
        id: Date.now().toString(),
        workPlanId: plan.id,
        projectId: plan.projectId,
        ...form,
      };
      onUpdate({ ...plan, tasks: [...plan.tasks, newTask], lastUpdated: now });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_TASK());
  };

  const deleteTask = (id: string) => {
    const tasks = plan.tasks
      .filter(t => t.id !== id)
      .map(t => ({ ...t, dependencies: t.dependencies.filter(d => d !== id) }));
    onUpdate({ ...plan, tasks, lastUpdated: new Date().toISOString() });
    setDeleteConfirm(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Sort by:</span>
          {(['startDate', 'endDate', 'priority', 'status'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                sortBy === opt ? 'bg-[#003f7d] text-white border-[#003f7d]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt === 'startDate' ? 'Start' : opt === 'endDate' ? 'End' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003f7d] text-white text-sm rounded-lg hover:bg-[#002d5a]"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {showForm && (
        <TaskForm
          form={form}
          setForm={setForm}
          tasks={plan.tasks}
          onSave={saveTask}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          editingId={editingId}
        />
      )}

      {sorted.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-400">
          <ListChecks size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks yet. Click &quot;Add Task&quot; to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(task => {
          const isExpanded = expandedId === task.id;
          const deps = task.dependencies.map(id => taskMap.get(id)).filter(Boolean) as WorkTask[];
          const blocking = plan.tasks.filter(t => t.dependencies.includes(task.id));
          const today = new Date();
          const daysLeft = task.endDate ? differenceInDays(parseISO(task.endDate), today) : null;

          return (
            <div
              key={task.id}
              className={`border rounded-xl bg-white overflow-hidden transition-all ${
                task.status === 'delayed' ? 'border-red-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[task.status] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800 truncate">{task.title}</span>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.dependencies.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <GitBranch size={10} /> {task.dependencies.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    {task.assignee && <span>{task.assignee}</span>}
                    {task.startDate && task.endDate && (
                      <span>
                        {format(parseISO(task.startDate), 'dd MMM')} → {format(parseISO(task.endDate), 'dd MMM yyyy')}
                      </span>
                    )}
                    {daysLeft !== null && task.status !== 'completed' && (
                      <span className={daysLeft < 0 ? 'text-red-500 font-medium' : daysLeft <= 3 ? 'text-orange-500' : ''}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${task.progress}%`, backgroundColor: STATUS_COLORS[task.status] }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{task.progress}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {deleteConfirm === task.id ? (
                    <>
                      <button onClick={() => deleteTask(task.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(task.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 text-sm space-y-3">
                  {task.description && (
                    <p className="text-slate-600 text-xs">{task.description}</p>
                  )}
                  {deps.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <GitBranch size={11} /> Blocked by
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {deps.map(d => (
                          <span
                            key={d.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                              d.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' : 'border-orange-200 text-orange-700 bg-orange-50'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: STATUS_COLORS[d.status] }}
                            />
                            {d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {blocking.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Blocking</div>
                      <div className="flex flex-wrap gap-2">
                        {blocking.map(d => (
                          <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-slate-200 text-slate-600 bg-white">
                            {d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {deps.length === 0 && blocking.length === 0 && !task.description && (
                    <p className="text-xs text-slate-400 italic">No additional details</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Work Plan Detail view ───────────────────────────────────────────────────

function WorkPlanDetail({
  plan, onUpdate, onBack,
}: { plan: WorkPlan; onUpdate: (p: WorkPlan) => void; onBack: () => void }) {
  const [tab, setTab] = useState<'dashboard' | 'tasks' | 'gantt'>('dashboard');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const preview = await parseWorkplanFile(file);
      setImportFilename(file.name);
      setImportPreview(preview);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Could not read file.');
    }
    e.target.value = '';
  };

  const confirmImport = (mode: 'replace' | 'merge') => {
    if (!importPreview) return;
    const newTasks = previewToTasks(importPreview, plan.id, plan.projectId);
    const tasks = mode === 'replace' ? newTasks : [...plan.tasks, ...newTasks];
    onUpdate({ ...plan, tasks, lastUpdated: new Date().toISOString() });
    setImportPreview(null);
  };

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks' as const, label: 'Tasks', icon: ListChecks },
    { id: 'gantt' as const, label: 'Gantt', icon: BarChart2 },
  ];

  return (
    <div>
      {importPreview && (
        <ImportModal
          preview={importPreview}
          filename={importFilename}
          mode={importMode}
          setMode={setImportMode}
          onConfirm={confirmImport}
          onCancel={() => setImportPreview(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={onBack}
          className="mt-0.5 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {plan.projectSymbol}
            </span>
            <StatusBadge status={derivePlanStatus(plan.tasks)} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mt-1 leading-tight">{plan.projectTitle}</h2>
          <div className="text-sm text-slate-500 mt-0.5">
            {plan.projectManager} · Updated {format(parseISO(plan.lastUpdated), 'dd MMM yyyy')}
          </div>
        </div>
        {/* Import / Download template actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`${basePath}/work_plan_template.xlsx`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={14} /> Template
          </a>
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#003f7d] text-[#003f7d] text-sm rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Upload size={14} /> Import Excel
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {importError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {importError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-[#003f7d] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'tasks' && (
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {plan.tasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <PlanDashboard plan={plan} />}
      {tab === 'tasks' && <TasksTab plan={plan} onUpdate={onUpdate} />}
      {tab === 'gantt' && (
        <div>
          <p className="text-xs text-slate-500 mb-3">
            Click a task bar to jump to it in the Tasks tab.
          </p>
          <GanttChart
            tasks={plan.tasks}
            onTaskClick={() => setTab('tasks')}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WorkPlansPage() {
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [filterPm, setFilterPm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [collapsedPms, setCollapsedPms] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setPlans(await store.getWorkPlans());
      setProjects(await store.getProjects());
    };
    load();
  }, []);

  const reloadPlans = async () => {
    setPlans(await store.getWorkPlans());
  };

  const createPlan = async () => {
    if (!newProjectId) return;
    const project = projects.find(p => p.id === newProjectId);
    if (!project) return;
    const username = typeof window !== 'undefined' ? localStorage.getItem('fao_user') ?? '' : '';
    const created = await store.createWorkPlan({
      projectId: project.id,
      projectSymbol: project.symbol,
      projectTitle: project.title,
      projectManager: project.projectManager,
      createdBy: username,
      lastUpdated: new Date().toISOString(),
      tasks: [],
    });
    await reloadPlans();
    setShowNewForm(false);
    setNewProjectId('');
    setSelectedPlanId(created.id);
  };

  const updatePlan = async (updated: WorkPlan) => {
    await store.saveWorkPlan(updated);
    await reloadPlans();
  };

  const deletePlan = async (id: string) => {
    await store.deleteWorkPlan(id);
    await reloadPlans();
    setDeleteConfirm(null);
    if (selectedPlanId === id) setSelectedPlanId(null);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null;

  // Unique PMs for filter
  const allPms = useMemo(() => [...new Set(plans.map(p => p.projectManager).filter(Boolean))].sort(), [plans]);

  // Filtered plans
  const filtered = useMemo(() => {
    return plans.filter(p => {
      if (filterPm && p.projectManager !== filterPm) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.projectSymbol.toLowerCase().includes(q) ||
          p.projectTitle.toLowerCase().includes(q) ||
          p.projectManager.toLowerCase().includes(q);
      }
      return true;
    });
  }, [plans, search, filterPm]);

  // Group by PM
  const grouped = useMemo(() => {
    const map = new Map<string, WorkPlan[]>();
    filtered.forEach(p => {
      const pm = p.projectManager || 'Unassigned';
      if (!map.has(pm)) map.set(pm, []);
      map.get(pm)!.push(p);
    });
    return map;
  }, [filtered]);

  const togglePm = (pm: string) => {
    setCollapsedPms(prev => {
      const next = new Set(prev);
      if (next.has(pm)) next.delete(pm); else next.add(pm);
      return next;
    });
  };

  // Show detail view if a plan is selected
  if (selectedPlan) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <WorkPlanDetail
          plan={selectedPlan}
          onUpdate={async plan => { await updatePlan(plan); setSelectedPlanId(plan.id); }}
          onBack={() => setSelectedPlanId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={22} className="text-[#003f7d]" />
            Work Plans
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {plans.length} plan{plans.length !== 1 ? 's' : ''} across {allPms.length} project manager{allPms.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/work_plan_template.xlsx`}
            download
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={15} /> Download Template
          </a>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#003f7d] text-white text-sm rounded-lg hover:bg-[#002d5a] transition-colors"
          >
            <Plus size={16} /> New Work Plan
          </button>
        </div>
      </div>

      {/* New plan form */}
      {showNewForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Create Work Plan</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Project *</label>
              <select
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
              >
                <option value="">— choose a project —</option>
                {projects
                  .filter(p => !plans.some(wp => wp.projectId === p.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.symbol} – {p.title.slice(0, 60)}{p.title.length > 60 ? '…' : ''}
                    </option>
                  ))}
              </select>
            </div>
            <button
              onClick={createPlan}
              disabled={!newProjectId}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#003f7d] text-white text-sm rounded-lg hover:bg-[#002d5a] disabled:opacity-40"
            >
              <Check size={14} /> Create
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewProjectId(''); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            placeholder="Search by project or PM…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
          value={filterPm}
          onChange={e => setFilterPm(e.target.value)}
        >
          <option value="">All Project Managers</option>
          {allPms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
        </select>
      </div>

      {/* Plan list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {plans.length === 0
              ? 'No work plans yet. Click "New Work Plan" to create one.'
              : 'No plans match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([pm, pmPlans]) => (
            <div key={pm} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => togglePm(pm)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-700">{pm}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {pmPlans.length} plan{pmPlans.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {collapsedPms.has(pm) ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </button>

              {!collapsedPms.has(pm) && (
                <div className="divide-y divide-slate-100">
                  {pmPlans.map(plan => {
                    const status = derivePlanStatus(plan.tasks);
                    const completion = planCompletion(plan.tasks);

                    return (
                      <div key={plan.id} className="px-4 py-3 hover:bg-blue-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {plan.projectSymbol}
                              </span>
                              <StatusBadge status={status} />
                              <span className="text-xs text-slate-400">
                                {plan.tasks.length} task{plan.tasks.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-tight truncate">{plan.projectTitle}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex-1 max-w-xs flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${completion}%`, backgroundColor: STATUS_COLORS[status] }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 w-8 shrink-0">{completion}%</span>
                              </div>
                              <span className="text-xs text-slate-400">
                                Updated {format(parseISO(plan.lastUpdated), 'dd MMM yyyy')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setSelectedPlanId(plan.id)}
                              className="px-3 py-1.5 text-sm text-[#003f7d] border border-[#003f7d] rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Open
                            </button>
                            {deleteConfirm === plan.id ? (
                              <>
                                <button onClick={() => deletePlan(plan.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteConfirm(plan.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
