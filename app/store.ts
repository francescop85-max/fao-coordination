'use client';

import { Project, Meeting, WorkPlan } from './types';

// ─── Projects ────────────────────────────────────────────────────────────────

async function loadProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  return res.json();
}

async function saveProject(project: Project): Promise<Project> {
  const res = await fetch(`/api/projects/${project.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return res.json();
}

async function createProject(project: Omit<Project, 'id'>): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return res.json();
}

async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' });
}

// ─── Meetings ────────────────────────────────────────────────────────────────

async function loadMeetings(): Promise<Meeting[]> {
  const res = await fetch('/api/meetings');
  if (!res.ok) return [];
  return res.json();
}

async function saveMeeting(meeting: Meeting): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${meeting.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  });
  return res.json();
}

async function createMeeting(meeting: Omit<Meeting, 'id'>): Promise<Meeting> {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  });
  return res.json();
}

async function deleteMeeting(id: string): Promise<void> {
  await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
}

// ─── Work Plans ───────────────────────────────────────────────────────────────

async function loadWorkPlans(): Promise<WorkPlan[]> {
  const res = await fetch('/api/workplans');
  if (!res.ok) return [];
  return res.json();
}

async function saveWorkPlan(plan: WorkPlan): Promise<WorkPlan> {
  const res = await fetch(`/api/workplans/${plan.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  return res.json();
}

async function createWorkPlan(plan: Omit<WorkPlan, 'id'>): Promise<WorkPlan> {
  const res = await fetch('/api/workplans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  return res.json();
}

async function deleteWorkPlan(id: string): Promise<void> {
  await fetch(`/api/workplans/${id}`, { method: 'DELETE' });
}

export const store = {
  getProjects: loadProjects,
  saveProject,
  createProject,
  deleteProject,
  getMeetings: loadMeetings,
  saveMeeting,
  createMeeting,
  deleteMeeting,
  getWorkPlans: loadWorkPlans,
  saveWorkPlan,
  createWorkPlan,
  deleteWorkPlan,
};
