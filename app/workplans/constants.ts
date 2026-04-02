import { TaskStatus, TaskPriority } from '../types';

export const STATUS_COLORS: Record<TaskStatus, string> = {
  'not-started': '#94a3b8',
  'in-progress': '#007bc0',
  'completed':   '#2e7d32',
  'delayed':     '#ef4444',
};

export const STATUS_BG: Record<TaskStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  'completed':   'bg-green-100 text-green-700',
  'delayed':     'bg-red-100 text-red-700',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Completed',
  'delayed':     'Delayed',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  'low':      '#94a3b8',
  'medium':   '#f59e0b',
  'high':     '#f97316',
  'critical': '#ef4444',
};

export const PRIORITY_BG: Record<TaskPriority, string> = {
  'low':      'bg-slate-100 text-slate-600',
  'medium':   'bg-amber-100 text-amber-700',
  'high':     'bg-orange-100 text-orange-700',
  'critical': 'bg-red-100 text-red-700',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  'low':      'Low',
  'medium':   'Medium',
  'high':     'High',
  'critical': 'Critical',
};

export const ALL_STATUSES: TaskStatus[] = ['not-started', 'in-progress', 'completed', 'delayed'];
export const ALL_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
